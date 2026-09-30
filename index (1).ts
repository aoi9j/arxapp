import { createClient } from "npm:@supabase/supabase-js@2";
import {
  sendNotification,
  type PushSubscription,
} from "npm:web-push-neo@0.1.2";

// ============================================================
// ARX NOTIFY
// ============================================================

// Supabase
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

let SUPABASE_SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_SECRET_KEY) {
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeysRaw) {
    try {
      const secretKeys = JSON.parse(secretKeysRaw);
      SUPABASE_SECRET_KEY = secretKeys["default"];
    } catch (_) {
      // Se comprobara mas abajo
    }
  }
}

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Faltan las credenciales de Supabase");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
);

// ============================================================
// VAPID
// ============================================================

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  throw new Error(
    "Faltan VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT",
  );
}

const vapidDetails = {
  subject: VAPID_SUBJECT,
  publicKey: VAPID_PUBLIC_KEY,
  privateKey: VAPID_PRIVATE_KEY,
};

// ============================================================
// TIPOS
// ============================================================

type NotificationType =
  | "flower"
  | "connection"
  | "message";

interface NotifyRequest {
  type: NotificationType;
  recipient_id: string;
}

// ============================================================
// TEXTOS
// ============================================================

const NOTIFICATIONS: Record<
  NotificationType,
  {
    title: string;
    body: string;
    tag: string;
  }
> = {
  flower: {
    title: "ARX",
    body: "Tienes una flor nueva",
    tag: "arx-flower",
  },

  connection: {
    title: "ARX",
    body: "Tienes una conexi" + String.fromCharCode(243) + "n nueva",
    tag: "arx-connection",
  },

  message: {
    title: "ARX",
    body: "Tienes un mensaje nuevo",
    tag: "arx-message",
  },
};

// ============================================================
// RESPUESTAS
// ============================================================

function json(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

// ============================================================
// UUID
// ============================================================

function isUUID(value: unknown): boolean {
  const id = String(value ?? "").trim();
  return id.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      .test(id);
}

// ============================================================
// HORA LOCAL DE ESPANA
//
// Usamos Europe/Madrid para que 23:00-08:00 respete
// automaticamente horario de verano/invierno.
// ============================================================

function getMadridMinutes(): number {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);

  const hour = Number(
    parts.find((p) => p.type === "hour")?.value ?? "0",
  );

  const minute = Number(
    parts.find((p) => p.type === "minute")?.value ?? "0",
  );

  return hour * 60 + minute;
}

// ============================================================
// CONVERTIR TIME DE POSTGRES A MINUTOS
// ============================================================

function timeToMinutes(
  value: string | null | undefined
): number {
  if (!value) return 0;

  const match = value.match(/^([0-9]{1,2}):([0-9]{2})/);

  if (!match) return 0;

  return Number(match[1]) * 60 + Number(match[2]);
}

// ==========================================================
// COMPROBAR SILENCIO
// ============================================================

function isQuietHours(
  quietEnabled: boolean,
  quietStart: string,
  quietEnd: string,
): boolean {
  if (!quietEnabled) {
    return false;
  }

  const now = getMadridMinutes();

  const start = timeToMinutes(quietStart);
  const end = timeToMinutes(quietEnd);

  // Mismo horario: no consideramos silencio.
  if (start === end) {
    return false;
  }

  // Ejemplo normal: 08:00 -> 23:00
  if (start < end) {
    return now >= start && now < end;
  }

  // Ejemplo nocturno: 23:00 -> 08:00
  return now >= start || now < end;
}

// ============================================================
// OBTENER PREFERENCIAS
// ============================================================

async function getPreferences(userId: string) {
  const { data, error } = await supabase
    .from("arx_notification_prefs")
    .select(
      "user_id,flower_enabled,connection_enabled,message_enabled," +
        "quiet_enabled,quiet_start,quiet_end,last_message_notification",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Error obteniendo preferencias: " + error.message,
    );
  }

  // Si todavia no tiene preferencias, usamos los valores
  // predeterminados de la tabla.
  if (!data) {
    return {
      user_id: userId,
      flower_enabled: true,
      connection_enabled: true,
      message_enabled: true,
      quiet_enabled: true,
      quiet_start: "23:00:00",
      quiet_end: "08:00:00",
      last_message_notification: null,
    };
  }

  return data;
}

// ============================================================
// PREFERENCIA ACTIVADA
// ============================================================

function notificationEnabled(
  type: NotificationType,
  prefs: any,
): boolean {
  switch (type) {
    case "flower":
      return prefs.flower_enabled === true;

    case "connection":
      return prefs.connection_enabled === true;

    case "message":
      return prefs.message_enabled === true;

    default:
      return false;
  }
}

// ============================================================
// LIMITAR MENSAJES A 1 CADA 10 MINUTOS
// ============================================================

async function checkMessageRateLimit(
  userId: string,
  lastNotification: string | null,
): Promise<boolean> {
  const now = Date.now();

  if (lastNotification) {
    const last = new Date(lastNotification).getTime();

    if (!Number.isNaN(last)) {
      const elapsed = now - last;

      // 10 minutos = 600.000 ms
      if (elapsed < 10 * 60 * 1000) {
        return false;
      }
    }
  }

  // Actualizamos la ultima notificacion de mensajes.
  const { error } = await supabase
    .from("arx_notification_prefs")
    .update({
      last_message_notification: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error(
      "No se pudo actualizar last_message_notification:",
      error.message,
    );

    // No bloqueamos el aviso si el registro de rate-limit
    // falla; simplemente continuamos.
  }

  return true;
}

// ============================================================
// OBTENER SUSCRIPCIONES PUSH
// ============================================================

async function getSubscriptions(userId: string) {
  const { data, error } = await supabase
    .from("arx_push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      "Error obteniendo suscripciones: " + error.message,
    );
  }

  return data ?? [];
}

// ============================================================
// BORRAR SUSCRIPCION INVALIDA
// ============================================================

async function deleteSubscription(id: number) {
  const { error } = await supabase
    .from("arx_push_subscriptions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(
      "No se pudo eliminar suscripcion:",
      error.message,
    );
  }
}

// ============================================================
// ENVIAR PUSH
// ============================================================

async function sendPush(
  subscription: any,
  notification: {
    title: string;
    body: string;
    tag: string;
  },
) {
  const pushSubscription: PushSubscription = {
    endpoint: subscription.endpoint,

    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    tag: notification.tag,
  });

  return await sendNotification(
    pushSubscription,
    payload,
    {
      vapidDetails,
      TTL: 60,
      urgency: "high",
    },
  );
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

Deno.serve(async (req) => {
  try {
    // --------------------------------------------------------
    // Solo POST
    // --------------------------------------------------------

    if (req.method !== "POST") {
      return json(
        {
          ok: false,
          error: "method_not_allowed",
        },
        405,
      );
    }

    // --------------------------------------------------------
    // Leer JSON
    // --------------------------------------------------------

    let body: NotifyRequest;

    try {
      body = await req.json();
    } catch (_) {
      return json(
        {
          ok: false,
          error: "invalid_json",
        },
        400,
      );
    }

    // --------------------------------------------------------
    // Validar tipo
    // --------------------------------------------------------

    if (
      body.type !== "flower" &&
      body.type !== "connection" &&
      body.type !== "message"
    ) {
      return json(
        {
          ok: false,
          error: "invalid_notification_type",
        },
        400,
      );
    }

    // --------------------------------------------------------
    // Validar receptor
    // --------------------------------------------------------

    if (
      typeof body.recipient_id !== "string" ||
      !isUUID(body.recipient_id)
    ) {
      return json(
        {
          ok: false,
          error: "invalid_recipient_id",
        },
        400,
      );
    }

    const recipientId = String(body.recipient_id ?? "").trim();
    const type = body.type;

    console.log(
      "ARX Notify: " + type + " -> " + recipientId,
    );

    // --------------------------------------------------------
    // PREFERENCIAS
    // --------------------------------------------------------

    const prefs = await getPreferences(recipientId);

    // --------------------------------------------------------
    // ?TIENE ACTIVADO ESTE TIPO DE AVISO?
    // --------------------------------------------------------

    if (!notificationEnabled(type, prefs)) {
      console.log(
        "ARX Notify: " + type + " desactivado para " + recipientId,
      );

      return json({
        ok: true,
        sent: false,
        reason: "notification_disabled",
      });
    }

    // --------------------------------------------------------
    // HORARIO DE SILENCIO
    //
    // Los avisos durante silencio SE DESCARTAN.
    // NO se guardan para enviarlos despues.
    // --------------------------------------------------------

    if (
      isQuietHours(
        prefs.quiet_enabled,
        prefs.quiet_start,
        prefs.quiet_end,
      )
    ) {
      console.log(
        "ARX Notify: silencio activo para " + recipientId,
      );

      return json({
        ok: true,
        sent: false,
        reason: "quiet_hours",
      });
    }

    // --------------------------------------------------------
    // MENSAJES: MAXIMO 1 CADA 10 MINUTOS
    // --------------------------------------------------------

    if (type === "message") {
      const allowed = await checkMessageRateLimit(
        recipientId,
        prefs.last_message_notification,
      );

      if (!allowed) {
        console.log(
          "ARX Notify: limite de mensajes activo para " + recipientId,
        );

        return json({
          ok: true,
          sent: false,
          reason: "message_rate_limit",
        });
      }
    }

    // --------------------------------------------------------
    // OBTENER SUSCRIPCIONES
    // --------------------------------------------------------

    const subscriptions = await getSubscriptions(recipientId);

    if (subscriptions.length === 0) {
      console.log(
        "ARX Notify: " + recipientId + " no tiene suscripciones push",
      );

      return json({
        ok: true,
        sent: false,
        reason: "no_push_subscription",
      });
    }

    // --------------------------------------------------------
    // NOTIFICACION
    // --------------------------------------------------------

    const notification = NOTIFICATIONS[type];

    let sent = 0;
    let failed = 0;
    let removed = 0;

    // --------------------------------------------------------
    // ENVIAR A TODOS LOS DISPOSITIVOS
    // --------------------------------------------------------

    for (const subscription of subscriptions) {
      try {
        const result = await sendPush(
          subscription,
          notification,
        );

        console.log(
          "Push enviado a " + subscription.id + ": " + result.statusCode,
        );

        sent++;
      } catch (error) {
        failed++;

        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error
            ? Number(
                (error as { statusCode?: number }).statusCode,
              )
            : undefined;

        console.error(
          "Error enviando push a " + subscription.id + ":",
          error,
        );

        // 404/410 normalmente significa que la suscripcion
        // ya no es valida.
        if (statusCode === 404 || statusCode === 410) {
          await deleteSubscription(subscription.id);
          removed++;
        }
      }
    }

    // --------------------------------------------------------
    // RESPUESTA
    // --------------------------------------------------------

    return json({
      ok: true,
      type,
      recipient_id: recipientId,
      sent,
      failed,
      removed,
    });
  } catch (error) {
    console.error(
      "ARX Notify error:",
      error,
    );

    return json(
      {
        ok: false,
        error: "internal_error",
      },
      500,
    );
  }
});