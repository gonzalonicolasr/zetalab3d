// admin-setup.js
// Safe setup script for ZETALAB admin functionality
// Only uses guaranteed-to-exist columns and graceful fallbacks

(function() {
    'use strict';

    // Configuration
    const SUPABASE_URL = 'https://fwmyiovamcxvinoxnput.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXlpb3ZhbWN4dmlub3hucHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzAzODksImV4cCI6MjA3MTc0NjM4OX0.x94-SZj7-BR9CGMzeujkjyk_7iItajoHKkGRgIYPUTc';

    // Initialize Supabase client
    let supabase;
    try {
        supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!supabase) throw new Error('Supabase not loaded');
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        return;
    }

    // Safe database initialization
    class SafeDatabaseSetup {
        constructor(supabaseClient) {
            this.supabase = supabaseClient;
            this.setupComplete = false;
        }

        // Check if tables exist without breaking
        async checkTableExists(tableName) {
            try {
                const { error } = await this.supabase
                    .from(tableName)
                    .select('id')
                    .limit(1);
                
                // Table exists if no permission/relation error
                return !error || !error.message.includes('relation') && !error.message.includes('does not exist');
            } catch {
                return false;
            }
        }

        // Safely create subscription plans if table exists
        async ensureSubscriptionPlans() {
            try {
                const tableExists = await this.checkTableExists('subscription_plans');
                if (!tableExists) {
                    console.warn('subscription_plans table not found, skipping setup');
                    return false;
                }

                // Check if plans already exist
                const { data: existing } = await this.supabase
                    .from('subscription_plans')
                    .select('id')
                    .limit(1);

                if (existing && existing.length > 0) {
                    console.log('Subscription plans already exist');
                    return true;
                }

                // Create basic plans
                const plans = [
                    {
                        plan_data: {
                            name: 'Free',
                            price: 0,
                            period: 'monthly',
                            max_pieces: 5,
                            max_calculations: 10,
                            features: ['Calculadora básica', 'Guardado limitado']
                        }
                    },
                    {
                        plan_data: {
                            name: 'Premium',
                            price: 1500,
                            period: 'monthly',
                            max_pieces: -1,
                            max_calculations: -1,
                            features: ['Guardado ilimitado', 'Historial completo', 'Exportación HTML']
                        }
                    },
                    {
                        plan_data: {
                            name: 'Premium Anual',
                            price: 15000,
                            period: 'yearly',
                            max_pieces: -1,
                            max_calculations: -1,
                            features: ['Guardado ilimitado', 'Historial completo', 'Exportación HTML', 'Descuento anual']
                        }
                    }
                ];

                const { error } = await this.supabase
                    .from('subscription_plans')
                    .insert(plans);

                if (error) throw error;
                
                console.log('Subscription plans created successfully');
                return true;
            } catch (error) {
                console.warn('Could not setup subscription plans:', error.message);
                return false;
            }
        }

        // Initialize subscription service with fallbacks
        async initializeSubscriptionService() {
            try {
                // Ensure MinimalSubscriptionService is loaded
                if (typeof window.MinimalSubscriptionService === 'undefined') {
                    console.warn('MinimalSubscriptionService not loaded, creating fallback');
                    
                    // Create a simple fallback service
                    window.subscriptionService = {
                        hasActiveSubscription: async (userId) => {
                            try {
                                const { data } = await supabase
                                    .from('subscriptions')
                                    .select('status')
                                    .eq('user_id', userId)
                                    .eq('status', 'active')
                                    .maybeSingle();
                                return !!data;
                            } catch {
                                return false;
                            }
                        },
                        getUserSubscription: async () => null,
                        canPerformAction: async () => true // Fallback: allow all actions
                    };
                } else {
                    window.subscriptionService = new window.MinimalSubscriptionService(supabase);
                }
                
                console.log('Subscription service initialized');
                return true;
            } catch (error) {
                console.error('Failed to initialize subscription service:', error);
                return false;
            }
        }

        // Run full setup
        async runSetup() {
            console.log('🔧 Starting ZETALAB admin setup...');
            
            const results = {
                supabase: !!supabase,
                subscriptionPlans: await this.ensureSubscriptionPlans(),
                subscriptionService: await this.initializeSubscriptionService()
            };

            this.setupComplete = Object.values(results).every(Boolean);
            
            console.log('Setup results:', results);
            console.log(this.setupComplete ? '✅ Setup completed successfully' : '⚠️ Setup completed with warnings');
            
            return results;
        }

        // Health check
        async healthCheck() {
            const checks = {
                supabase: !!supabase,
                subscriptionService: !!window.subscriptionService,
                database: false,
                plans: false
            };

            try {
                // Test database connection
                const { error: dbError } = await supabase.from('pieces').select('id').limit(1);
                checks.database = !dbError;
                
                // Test subscription plans
                const { error: planError } = await supabase.from('subscription_plans').select('id').limit(1);
                checks.plans = !planError;
            } catch (error) {
                console.warn('Health check warnings:', error.message);
            }

            return checks;
        }
    }

    // Global functions for admin dashboard
    window.adminSetup = {
        // Initialize everything
        async initialize() {
            const setup = new SafeDatabaseSetup(supabase);
            return await setup.runSetup();
        },

        // Health check
        async healthCheck() {
            const setup = new SafeDatabaseSetup(supabase);
            return await setup.healthCheck();
        },

        // Get safe stats
        async getStats() {
            const stats = {
                users: 0,
                pieces: 0,
                calculations: 0,
                subscriptions: 0
            };

            try {
                const queries = [
                    supabase.from('auth.users').select('id', { count: 'exact' }),
                    supabase.from('pieces').select('id', { count: 'exact' }),
                    supabase.from('piece_versions').select('id', { count: 'exact' }),
                    supabase.from('subscriptions').select('id').eq('status', 'active')
                ];

                const [users, pieces, calculations, subscriptions] = await Promise.allSettled(queries);

                stats.users = users.status === 'fulfilled' ? users.value.count || 0 : 0;
                stats.pieces = pieces.status === 'fulfilled' ? pieces.value.count || 0 : 0;
                stats.calculations = calculations.status === 'fulfilled' ? calculations.value.count || 0 : 0;
                stats.subscriptions = subscriptions.status === 'fulfilled' ? subscriptions.value.data?.length || 0 : 0;

            } catch (error) {
                console.warn('Error getting stats:', error);
            }

            return stats;
        },

        // Export current data safely
        async exportData() {
            const data = {
                timestamp: new Date().toISOString(),
                stats: await this.getStats(),
                health: await this.healthCheck()
            };

            return data;
        }
    };

    // Auto-initialize if in admin context
    if (window.location.pathname.includes('admin')) {
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                await window.adminSetup.initialize();
            } catch (error) {
                console.error('Auto-initialization failed:', error);
            }
        });
    }

    console.log('🚀 ZETALAB admin setup loaded');
})();