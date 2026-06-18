La mecánica completa sería así:
Alta del tenant
El tenant se registra y elige un plan. Se crea el registro en tenants con su plan_id y se genera una billing_subscription con status = 'trial' si ofrecés período de prueba, o directo 'active'. El period_start y period_end definen el ciclo de facturación (ej: 1 al 31 de cada mes).
El tenant crea portales y adhiere servicios
Dentro de su cuenta crea tenant_portals y va habilitando servicios en cada portal a través de portal_services. Acá es donde entra plan_service_pricing: cuando intenta adherir un servicio, tu backend verifica si ese servicio está permitido en su plan (max_services en plans) y cuánto le va a costar.
Cierre de período (job mensual)
Al final de cada ciclo, un job recorre todas las suscripciones activas y genera los billing_line_items del período:

Un ítem type = 'plan' con el price del plan
Un ítem type = 'portal' por cada portal activo (si cobrás por portal)
Un ítem type = 'service' por cada portal_service con is_enabled = true cuyo precio en plan_service_pricing tenga is_included = false

La suma de esos ítems es el total a cobrar. Luego integrás con el gateway de pagos (Stripe, Mercado Pago) para ejecutar el cobro y actualizás el status de la suscripción según el resultado: sigue 'active' si pagó, pasa a 'past_due' si falló.
Cambio de plan (upgrade/downgrade)
Si el tenant cambia de plan en mitad del ciclo, tenés dos opciones. La más simple es aplicar el nuevo plan desde el próximo período. La más justa es prorratear: cerrás los line_items del período actual hasta la fecha de cambio y abrís nuevos con el nuevo plan desde ese día. El campo period_start / period_end en cada line_item es exactamente para soportar esto.
Cancelación
El tenant cancela → status = 'cancelled' en billing_subscriptions. Podés dejarlo activo hasta el fin del período ya pago o cortarlo inmediatamente según tu política.

El flujo general sería:
tenant se registra
  → crea subscription (trial/active)
    → crea portales
      → adhiere servicios
        → [fin de período] job genera line_items
          → cobra via gateway
            → actualiza status
¿Querés que profundice en alguna parte, como el job de cierre o el proration del cambio de plan?