// CONFIGURACIÓN DE MERCADO PAGO
const MERCADO_PAGO_PUBLIC_KEY = "APP_USR_xxxxxxx-xxxxxxx"; // Tu public key de MP
const MERCADO_PAGO_ACCESS_TOKEN = "APP_USR_xxxxxxx-xxxxxxx"; // Tu access token (GUARDAR EN BACKEND SEGURO)

// Inicializar SDK de Mercado Pago
const mp = new MercadoPago(MERCADO_PAGO_PUBLIC_KEY, {
    locale: 'es-AR'
});

// CREAR PREFERENCIA DE PAGO EN MERCADO PAGO
async function crearPreferenciaMercadoPago(dni, nombre, monto) {
    try {
        // Esto debería hacerse desde tu BACKEND (Node.js, Python, etc)
        // Nunca exponer el ACCESS_TOKEN en cliente
        const response = await fetch('https://tu-backend.com/crear-preferencia-mp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dni: dni,
                nombre: nombre,
                monto: monto
            })
        });

        const data = await response.json();
        return data.preferenceId; // ID que usaremos para abrir el checkout
    } catch (error) {
        console.error('Error creando preferencia:', error);
        throw error;
    }
}

// ABRIR CHECKOUT DE MERCADO PAGO
window.abrirCheckoutMercadoPago = async function(dni, nombre, apellido, telefono, monto) {
    try {
        const preferenceId = await crearPreferenciaMercadoPago(dni, nombre, monto);
        
        // Guardar DNI en sessionStorage para usarlo después del pago
        sessionStorage.setItem('dni_pago_pendiente', dni);
        
        // Abrir checkout
        mp.checkout({
            preference: {
                id: preferenceId
            },
            autoOpen: true
        });
    } catch (error) {
        alert('Error al abrir pago: ' + error.message);
    }
};

// VERIFICAR ESTADO DEL PAGO (se ejecuta después del redirect)
async function verificarYActualizarEstadoPago() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('payment_id');
    const dniPendiente = sessionStorage.getItem('dni_pago_pendiente');

    if (!paymentId || !dniPendiente) return;

    try {
        // Consultar estado del pago a tu backend
        const response = await fetch(`https://tu-backend.com/verificar-pago?payment_id=${paymentId}`, {
            method: 'GET'
        });

        const datoPago = await response.json();

        if (datoPago.status === 'approved') {
            // PAGO APROBADO: Actualizar Firebase
            const dniLimpio = dniPendiente.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            await updateDoc(doc(db, "dnis_habilitados", dniLimpio), {
                estado: "pagado",
                fecha_pago: serverTimestamp(),
                payment_id: paymentId,
                monto_pagado: datoPago.amount
            });

            // Guardar sesión y redirigir al cartón
            localStorage.setItem('fgs_dni_sesion', dniLimpio);
            sessionStorage.removeItem('dni_pago_pendiente');

            // Redirigir al carton
            window.location.href = '?pase=' + dniLimpio;
        } else if (datoPago.status === 'pending') {
            alert('⏳ Tu pago está siendo procesado. Te habilitaremos en breve.');
        } else {
            alert('❌ El pago fue rechazado. Intentá nuevamente.');
        }
    } catch (error) {
        console.error('Error verificando pago:', error);
    }
}

// Ejecutar verificación cuando carga la página (después del redirect de MP)
window.addEventListener('DOMContentLoaded', () => {
    verificarYActualizarEstadoPago();
});
