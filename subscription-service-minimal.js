// subscription-service-minimal.js
// Minimal subscription service that works with guaranteed database columns only

class MinimalSubscriptionService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Get subscription plans using minimal structure
    async getSubscriptionPlans() {
        try {
            const { data, error } = await this.supabase
                .from('subscription_plans')
                .select('id, created_at, plan_data')
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Extract plan data from JSONB or use fallbacks
            return data.map(plan => ({
                id: plan.id,
                name: plan.plan_data?.name || 'Plan',
                price: plan.plan_data?.price || 0,
                period: plan.plan_data?.period || 'monthly',
                maxPieces: plan.plan_data?.max_pieces || 5,
                maxCalculations: plan.plan_data?.max_calculations || 10,
                features: plan.plan_data?.features || []
            }));
        } catch (error) {
            console.warn('Error loading plans, using defaults:', error);
            // Return hardcoded fallback plans
            return [
                {
                    id: 'free',
                    name: 'Free',
                    price: 0,
                    period: 'monthly',
                    maxPieces: 5,
                    maxCalculations: 10,
                    features: ['Calculadora básica', 'Guardado limitado']
                },
                {
                    id: 'premium',
                    name: 'Premium',
                    price: 1500,
                    period: 'monthly',
                    maxPieces: -1, // Unlimited
                    maxCalculations: -1, // Unlimited
                    features: ['Guardado ilimitado', 'Historial completo', 'Exportación HTML']
                }
            ];
        }
    }

    // Check if user has active subscription (cached)
    async hasActiveSubscription(userId) {
        if (!userId) return false;

        // Check cache first
        const cacheKey = `subscription_${userId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.value;
        }

        try {
            const { data, error } = await this.supabase
                .from('subscriptions')
                .select('id, status, subscription_data')
                .eq('user_id', userId)
                .eq('status', 'active')
                .maybeSingle();

            if (error && error.code !== 'PGRST116') { // Not found is OK
                throw error;
            }

            const hasActive = !!data;
            
            // Cache result
            this.cache.set(cacheKey, {
                value: hasActive,
                timestamp: Date.now()
            });

            return hasActive;
        } catch (error) {
            console.warn('Error checking subscription, defaulting to false:', error);
            return false;
        }
    }

    // Get user's current subscription details
    async getUserSubscription(userId) {
        if (!userId) return null;

        try {
            const { data, error } = await this.supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (!data) return null;

            // Extract subscription details from JSONB or use defaults
            return {
                id: data.id,
                status: data.status,
                planId: data.subscription_data?.plan_id || 'free',
                planName: data.subscription_data?.plan_name || 'Free',
                expiresAt: data.subscription_data?.expires_at || null,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };
        } catch (error) {
            console.warn('Error getting user subscription:', error);
            return null;
        }
    }

    // Create or update subscription (minimal implementation)
    async updateUserSubscription(userId, planId, status = 'active') {
        if (!userId || !planId) {
            throw new Error('User ID and plan ID are required');
        }

        try {
            // Get plan details
            const plans = await this.getSubscriptionPlans();
            const plan = plans.find(p => p.id === planId);
            
            if (!plan) {
                throw new Error('Plan not found');
            }

            const subscriptionData = {
                plan_id: planId,
                plan_name: plan.name,
                plan_price: plan.price,
                expires_at: this.calculateExpiryDate(plan.period),
                updated_at: new Date().toISOString()
            };

            // Try to update existing subscription first
            const { data: existing } = await this.supabase
                .from('subscriptions')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) {
                const { error } = await this.supabase
                    .from('subscriptions')
                    .update({
                        status,
                        subscription_data: subscriptionData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                // Create new subscription
                const { error } = await this.supabase
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        status,
                        subscription_data: subscriptionData,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                if (error) throw error;
            }

            // Clear cache
            this.cache.delete(`subscription_${userId}`);
            
            return { success: true };
        } catch (error) {
            console.error('Error updating subscription:', error);
            throw error;
        }
    }

    // Record payment transaction (minimal implementation)
    async recordPayment(userId, amount, planId, paymentMethod = 'unknown') {
        if (!userId || !amount) {
            throw new Error('User ID and amount are required');
        }

        try {
            const paymentData = {
                amount,
                plan_id: planId,
                payment_method: paymentMethod,
                status: 'completed',
                processed_at: new Date().toISOString()
            };

            const { error } = await this.supabase
                .from('payment_transactions')
                .insert({
                    user_id: userId,
                    payment_data: paymentData,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;
            
            return { success: true };
        } catch (error) {
            console.error('Error recording payment:', error);
            throw error;
        }
    }

    // Get user's usage stats
    async getUserUsageStats(userId) {
        if (!userId) return { pieces: 0, calculations: 0 };

        try {
            const [piecesResult, calculationsResult] = await Promise.all([
                this.supabase
                    .from('pieces')
                    .select('id', { count: 'exact' })
                    .eq('user_id', userId),
                this.supabase
                    .from('piece_versions')
                    .select('id', { count: 'exact' })
                    .eq('user_id', userId)
            ]);

            return {
                pieces: piecesResult.count || 0,
                calculations: calculationsResult.count || 0
            };
        } catch (error) {
            console.warn('Error getting usage stats:', error);
            return { pieces: 0, calculations: 0 };
        }
    }

    // Check if user can perform action based on limits
    async canPerformAction(userId, action) {
        if (!userId) return false;

        try {
            const hasActive = await this.hasActiveSubscription(userId);
            
            // Premium users can do anything
            if (hasActive) return true;

            // Free users have limits
            if (action === 'save_piece') {
                const stats = await this.getUserUsageStats(userId);
                return stats.pieces < 5; // Free limit
            }
            
            if (action === 'calculate') {
                // For simplicity, allow unlimited calculations for now
                // Could implement daily limits here
                return true;
            }

            return false;
        } catch (error) {
            console.warn('Error checking action permissions:', error);
            return false; // Fail safe
        }
    }

    // Helper: Calculate expiry date
    calculateExpiryDate(period) {
        const now = new Date();
        if (period === 'yearly') {
            now.setFullYear(now.getFullYear() + 1);
        } else {
            now.setMonth(now.getMonth() + 1);
        }
        return now.toISOString();
    }

    // Clear cache (useful for testing)
    clearCache() {
        this.cache.clear();
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.MinimalSubscriptionService = MinimalSubscriptionService;
}

// Usage example:
/*
// Initialize service
const subscriptionService = new MinimalSubscriptionService(supabaseClient);

// Check if user has premium access
const hasAccess = await subscriptionService.hasActiveSubscription(userId);

// Get user's subscription
const subscription = await subscriptionService.getUserSubscription(userId);

// Update subscription
await subscriptionService.updateUserSubscription(userId, 'premium', 'active');

// Check usage limits
const canSave = await subscriptionService.canPerformAction(userId, 'save_piece');
*/