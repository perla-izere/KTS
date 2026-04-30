<template>
  <div class="container py-5" style="max-width:900px">
    <h1 class="fw-bold mb-4"><i class="bi bi-lock me-2"></i>Checkout</h1>

    <div class="row g-4">
      <!-- Left: Address + Payment -->
      <div class="col-lg-7">
        <!-- Shipping Address -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header fw-bold bg-dark text-white">
            <i class="bi bi-geo-alt me-2"></i>Shipping Address
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-sm-6">
                <label class="form-label" for="fname">First Name *</label>
                <input id="fname" v-model="form.firstName" type="text" class="form-control" required />
              </div>
              <div class="col-sm-6">
                <label class="form-label" for="lname">Last Name *</label>
                <input id="lname" v-model="form.lastName" type="text" class="form-control" required />
              </div>
              <div class="col-12">
                <label class="form-label" for="address">Address *</label>
                <input id="address" v-model="form.address" type="text" class="form-control" placeholder="Street, Sector, District" required />
              </div>
              <div class="col-sm-6">
                <label class="form-label" for="city">City *</label>
                <input id="city" v-model="form.city" type="text" class="form-control" value="Kigali" />
              </div>
              <div class="col-sm-6">
                <label class="form-label" for="phone">Phone *</label>
                <input id="phone" v-model="form.phone" type="tel" class="form-control" placeholder="+250 7XX XXX XXX" />
              </div>
            </div>
          </div>
        </div>

        <!-- Payment -->
        <div class="card border-0 shadow-sm">
          <div class="card-header fw-bold bg-dark text-white">
            <i class="bi bi-credit-card me-2"></i>Payment (Stripe Test Mode)
          </div>
          <div class="card-body">
            <p class="text-muted small mb-3">
              <i class="bi bi-info-circle me-1"></i>
              Use test card: <code>4242 4242 4242 4242</code> · Any future date · Any CVV
            </p>
            <!-- Stripe Elements mount point -->
            <div id="card-element" class="form-control py-3" style="min-height:46px"></div>
            <div id="card-errors" class="text-danger small mt-2" role="alert">{{ cardError }}</div>
          </div>
        </div>
      </div>

      <!-- Right: Order Summary -->
      <div class="col-lg-5">
        <div class="card border-0 shadow-sm sticky-top" style="top:80px">
          <div class="card-header fw-bold bg-dark text-white">Order Review</div>
          <ul class="list-group list-group-flush">
            <li
              v-for="item in cartStore.items"
              :key="item.id"
              class="list-group-item d-flex align-items-center gap-2 py-2"
            >
              <img :src="item.image" width="40" height="40" style="object-fit:contain" class="bg-light p-1 rounded" :alt="item.title" />
              <span class="flex-grow-1 small text-truncate">{{ item.title }}</span>
              <span class="fw-semibold small">${{ (item.price * item.qty).toFixed(2) }}</span>
            </li>
          </ul>
          <div class="card-body">
            <div class="d-flex justify-content-between small mb-1">
              <span>Subtotal</span><span>${{ cartStore.subtotal.toFixed(2) }}</span>
            </div>
            <div class="d-flex justify-content-between small mb-1 text-muted">
              <span>Tax (18%)</span><span>${{ cartStore.tax.toFixed(2) }}</span>
            </div>
            <div class="d-flex justify-content-between small mb-3 text-muted">
              <span>Shipping</span>
              <span>{{ cartStore.shipping === 0 ? 'FREE' : '$' + cartStore.shipping.toFixed(2) }}</span>
            </div>
            <hr />
            <div class="d-flex justify-content-between fw-bold fs-5 mb-4">
              <span>Total</span>
              <span class="text-primary">${{ cartStore.total.toFixed(2) }}</span>
            </div>
            <button
              class="btn btn-primary w-100 fw-semibold py-2"
              @click="placeOrder"
              :disabled="processing"
              aria-label="Place order"
            >
              <span v-if="processing" class="spinner-border spinner-border-sm me-2"></span>
              {{ processing ? 'Processing…' : `Pay $${cartStore.total.toFixed(2)}` }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadStripe } from '@stripe/stripe-js'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const cartStore = useCartStore()
const authStore = useAuthStore()
const toastStore = useToastStore()

const form = ref({ firstName: '', lastName: '', address: '', city: 'Kigali', phone: '' })
const cardError = ref('')
const processing = ref(false)

const STRIPE_KEY = import.meta.env.VITE_STRIPE_KEY || 'pk_test_REPLACE_WITH_YOUR_KEY'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

let stripe, cardElement

onMounted(async () => {
  stripe = await loadStripe(STRIPE_KEY)
  const elements = stripe.elements()
  cardElement = elements.create('card', {
    style: {
      base: { fontSize: '16px', color: '#32325d', '::placeholder': { color: '#aab7c4' } }
    }
  })
  cardElement.mount('#card-element')
  cardElement.on('change', e => { cardError.value = e.error?.message || '' })
})

async function placeOrder() {
  if (!form.value.firstName || !form.value.address || !form.value.phone) {
    toastStore.show('Please fill in all address fields.', 'warning')
    return
  }

  processing.value = true
  cardError.value = ''

  try {
    // Call real backend to create a PaymentIntent
    const res = await fetch(`${API_URL}/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(cartStore.total * 100), // Stripe needs cents
        currency: 'usd'
      })
    })

    if (!res.ok) {
      throw new Error('Failed to create payment intent')
    }

    const { clientSecret } = await res.json()

    // Confirm the payment with the card details
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: `${form.value.firstName} ${form.value.lastName}`,
          phone: form.value.phone
        }
      }
    })

    if (error) {
      cardError.value = error.message
      toastStore.show(error.message, 'danger')
      return
    }

    if (paymentIntent.status === 'succeeded') {
      // Save order to auth store
      authStore.addOrder({
        items: cartStore.items,
        total: cartStore.total,
        address: `${form.value.firstName} ${form.value.lastName}, ${form.value.address}, ${form.value.city}`,
        phone: form.value.phone,
        paymentMethod: paymentIntent.id,
        date: new Date().toISOString()
      })

      cartStore.clear()
      toastStore.show('Payment successful! 🎉', 'success')
      router.push({ name: 'OrderSuccess' })
    }

  } catch (err) {
    console.error('Payment error:', err)
    toastStore.show('Payment failed. Please try again.', 'danger')
  } finally {
    processing.value = false
  }
}
</script>