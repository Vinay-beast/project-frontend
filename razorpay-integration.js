// razorpay-integration.js
// Razorpay Payment Integration Functions

// Add to app.js or create as separate file and include

// Add Razorpay payment functions
window.RazorpayIntegration = {

    // Create Razorpay payment order
    async initiateRazorpayPayment(orderData, totalAmount) {
        try {
            // First create the BookNook order
            const response = await Api.placeOrder(AUTH.token, orderData);
            const booknookOrder = response.order;

            // Create Razorpay order
            const razorpayOrderResponse = await fetch(`${API_BASE_URL}/payments/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AUTH.token}`
                },
                body: JSON.stringify({
                    amount: totalAmount,
                    orderId: booknookOrder.id,
                    currency: 'INR'
                })
            });

            const razorpayOrderData = await razorpayOrderResponse.json();

            if (!razorpayOrderData.success) {
                throw new Error(razorpayOrderData.message || 'Failed to create payment order');
            }

            // Launch Razorpay checkout
            return this.openRazorpayCheckout(razorpayOrderData, booknookOrder, totalAmount);

        } catch (error) {
            console.error('Razorpay payment initiation error:', error);
            throw error;
        }
    },

    // Open Razorpay checkout modal
    openRazorpayCheckout(razorpayOrderData, booknookOrder, amount) {
        return new Promise((resolve, reject) => {
            const options = {
                key: razorpayOrderData.key,
                amount: razorpayOrderData.amount,
                currency: razorpayOrderData.currency,
                name: 'BookNook',
                description: `Order #${booknookOrder.id} - Books Purchase`,
                image: '/logo.png', // Add your logo
                order_id: razorpayOrderData.orderId,
                prefill: {
                    name: AUTH.user?.name || '',
                    email: AUTH.user?.email || '',
                    contact: AUTH.user?.phone || ''
                },
                theme: {
                    color: '#10B981' // BookNook green theme
                },
                handler: async (response) => {
                    try {
                        await this.verifyPayment(response, booknookOrder.id);
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                },
                modal: {
                    ondismiss: () => {
                        reject(new Error('Payment cancelled by user'));
                    }
                }
            };

            const rzp = new Razorpay(options);
            rzp.open();
        });
    },

    // Verify payment with backend
    async verifyPayment(razorpayResponse, booknookOrderId) {
        try {
            const response = await fetch(`${API_BASE_URL}/payments/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AUTH.token}`
                },
                body: JSON.stringify({
                    razorpay_order_id: razorpayResponse.razorpay_order_id,
                    razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                    razorpay_signature: razorpayResponse.razorpay_signature,
                    booknook_order_id: booknookOrderId
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Payment verification failed');
            }

            return result;

        } catch (error) {
            console.error('Payment verification error:', error);
            throw error;
        }
    },

    // Get payment status
    async getPaymentStatus(orderId) {
        try {
            const response = await fetch(`${API_BASE_URL}/payments/status/${orderId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AUTH.token}`
                }
            });

            return await response.json();

        } catch (error) {
            console.error('Payment status error:', error);
            throw error;
        }
    }
};

// Enhanced order placement function with Razorpay integration
async function placeOrderWithRazorpay(orderData, totalAmount, paymentMethod) {
    try {
        if (paymentMethod === 'razorpay') {
            // Handle Razorpay payment
            await RazorpayIntegration.initiateRazorpayPayment(orderData, totalAmount);
            toast('Payment successful! Order placed.');

            // Clear cart and navigate
            CART = [];
            renderCartIcon();
            setActiveNav('orders');
            showSection('ordersSection');
            await renderOrders();

        } else {
            // Handle other payment methods (COD, Card)
            await Api.placeOrder(AUTH.token, orderData);
            toast('Order placed');

            // Clear cart and navigate
            CART = [];
            renderCartIcon();
            setActiveNav('orders');
            showSection('ordersSection');
            await renderOrders();
        }

    } catch (error) {
        console.error('Order placement error:', error);
        toast(error.message || 'Order failed');
        throw error;
    }
}