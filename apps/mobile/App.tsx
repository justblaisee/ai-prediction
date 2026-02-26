import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { clearTokens, mobileApi, saveTokens } from './src/lib/api';
import { Product, TrainStatus, User } from './src/types';

type Session = {
  user: User;
  organizationName: string;
};

type TabKey = 'dashboard' | 'products' | 'predictions' | 'profile';

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'Products' },
  { key: 'predictions', label: 'Predictions' },
  { key: 'profile', label: 'Profile' },
];

function statColor(index: number): string {
  const palette = ['#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#9333ea', '#dc2626', '#0284c7'];
  return palette[index % palette.length];
}

export default function App(): JSX.Element {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('admin@startup.test');
  const [password, setPassword] = useState('StartUp123!');
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [trainStatus, setTrainStatus] = useState<TrainStatus | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await mobileApi.health();
        setApiStatus('ok');
      } catch {
        setApiStatus('down');
      }

      try {
        const me = await mobileApi.me();
        setSession({
          user: me.user,
          organizationName: me.organization.name,
        });
      } catch {
        setSession(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!session) return;
    void loadProducts();
  }, [session]);

  useEffect(() => {
    if (!selectedProduct || trainStatus?.status !== 'running') return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const status = await mobileApi.trainStatus(selectedProduct.id);
          setTrainStatus(status);
        } catch {
          // polling errors can be ignored temporarily
        }
      })();
    }, 1500);
    return () => clearInterval(timer);
  }, [selectedProduct, trainStatus?.status]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(keyword) || p.sku.toLowerCase().includes(keyword)
    );
  }, [products, search]);

  const lowStockCount = useMemo(
    () => products.filter((p) => p.currentStock <= p.minThreshold).length,
    [products]
  );
  const totalStock = useMemo(() => products.reduce((sum, p) => sum + p.currentStock, 0), [products]);

  const chartSeries = useMemo(() => {
    return [...products]
      .sort((a, b) => b.currentStock - a.currentStock)
      .slice(0, 7)
      .map((p, index) => ({
        label: p.name.length > 12 ? `${p.name.slice(0, 12)}...` : p.name,
        value: p.currentStock,
        color: statColor(index),
      }));
  }, [products]);

  const maxChartValue = useMemo(() => Math.max(...chartSeries.map((x) => x.value), 1), [chartSeries]);

  async function loadProducts(): Promise<void> {
    setLoadingProducts(true);
    setError(null);
    try {
      const data = await mobileApi.products();
      setProducts(data.products);
      if (!selectedProduct && data.products.length > 0) {
        setSelectedProduct(data.products[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  }

  async function login(): Promise<void> {
    setError(null);
    try {
      const data = await mobileApi.login(email.trim(), password);
      await saveTokens(data.accessToken, data.refreshToken);
      setSession({
        user: data.user,
        organizationName: data.organization.name,
      });
      setTab('dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  }

  async function logout(): Promise<void> {
    await clearTokens();
    setSession(null);
    setProducts([]);
    setSelectedProduct(null);
    setTrainStatus(null);
    setSearch('');
    setTab('dashboard');
  }

  async function trainNow(): Promise<void> {
    if (!selectedProduct) return;
    setError(null);
    try {
      await mobileApi.train(selectedProduct.id);
      const status = await mobileApi.trainStatus(selectedProduct.id);
      setTrainStatus(status);
      setTab('predictions');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start training');
    }
  }

  const running = trainStatus?.status === 'running';

  if (booting) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.muted}>Booting mobile app...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginHero}>
          <Text style={styles.loginTitle}>Inventory AI Mobile</Text>
          <Text style={styles.loginSubtitle}>Portfolio Edition</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, apiStatus === 'ok' ? styles.badgeOk : styles.badgeDown]}>
              <Text style={styles.badgeText}>API {apiStatus.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.sectionTitle}>Sign In</Text>
          <TextInput style={styles.input} autoCapitalize="none" placeholder="Email" value={email} onChangeText={setEmail} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={() => void login()}>
            <Text style={styles.primaryButtonText}>Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory AI</Text>
          <Text style={styles.subtitle}>
            {session.organizationName} - {session.user.firstName}
          </Text>
        </View>
        <Pressable style={styles.outlineButton} onPress={() => void loadProducts()}>
          <Text style={styles.outlineButtonText}>Refresh</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 18 }}>
        {tab === 'dashboard' && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Products</Text>
                  <Text style={styles.statValue}>{products.length}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Total Stock</Text>
                  <Text style={styles.statValue}>{totalStock}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Low Stock</Text>
                  <Text style={styles.statValue}>{lowStockCount}</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Top Stock Items</Text>
              {chartSeries.length === 0 ? (
                <Text style={styles.muted}>No product data yet.</Text>
              ) : (
                chartSeries.map((item) => (
                  <View key={item.label} style={styles.chartRow}>
                    <Text style={styles.chartLabel}>{item.label}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.max((item.value / maxChartValue) * 100, 6)}%`, backgroundColor: item.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartValue}>{item.value}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {tab === 'products' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Products</Text>
            <TextInput
              style={styles.input}
              placeholder="Search by name or SKU"
              value={search}
              onChangeText={setSearch}
            />
            {loadingProducts ? (
              <ActivityIndicator color="#2563eb" style={{ marginTop: 12 }} />
            ) : (
              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                style={styles.list}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.productItem, selectedProduct?.id === item.id ? styles.productSelected : null]}
                    onPress={() => setSelectedProduct(item)}
                  >
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.muted}>
                      {item.sku} - stock {item.currentStock}/{item.minThreshold}
                    </Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        )}

        {tab === 'predictions' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Prediction Training</Text>
            <Text style={styles.muted}>
              Selected: {selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : 'Choose from Products tab'}
            </Text>
            <Pressable
              style={[styles.primaryButton, (!selectedProduct || running) && styles.buttonDisabled]}
              onPress={() => void trainNow()}
              disabled={!selectedProduct || running}
            >
              <Text style={styles.primaryButtonText}>{running ? 'Training...' : 'Train Model'}</Text>
            </Pressable>

            {trainStatus ? (
              <View style={styles.statusCard}>
                <Text style={styles.statusTitle}>Status: {trainStatus.status.toUpperCase()}</Text>
                <Text style={styles.muted}>{trainStatus.message}</Text>
                <Text style={styles.muted}>Progress: {trainStatus.progress}%</Text>
                {trainStatus.error ? <Text style={styles.error}>{trainStatus.error}</Text> : null}
              </View>
            ) : null}
          </View>
        )}

        {tab === 'profile' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>
                {session.user.firstName} {session.user.lastName}
              </Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>{session.user.email}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Role</Text>
              <Text style={styles.profileValue}>{session.user.role}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>API Health</Text>
              <Text style={styles.profileValue}>{apiStatus.toUpperCase()}</Text>
            </View>
            <Pressable style={[styles.outlineButton, { marginTop: 14 }]} onPress={() => void logout()}>
              <Text style={styles.outlineButtonText}>Logout</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        {TAB_ITEMS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            style={[styles.tabItem, tab === item.key ? styles.tabItemActive : null]}
          >
            <Text style={[styles.tabText, tab === item.key ? styles.tabTextActive : null]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#1e3a8a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  muted: {
    color: '#64748b',
  },
  error: {
    color: '#dc2626',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginRight: 8,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  statValue: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 3,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartLabel: {
    width: 98,
    fontSize: 12,
    color: '#334155',
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  chartValue: {
    width: 36,
    textAlign: 'right',
    color: '#0f172a',
    fontWeight: '700',
  },
  list: {
    maxHeight: 420,
    marginTop: 8,
  },
  productItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  productSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  productName: {
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusCard: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
  },
  statusTitle: {
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  profileLabel: {
    color: '#64748b',
  },
  profileValue: {
    color: '#0f172a',
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 6,
    marginBottom: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: '#1d4ed8',
  },
  tabText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  loginHero: {
    marginTop: 48,
    marginBottom: 14,
  },
  loginTitle: {
    fontSize: 28,
    color: '#0f172a',
    fontWeight: '800',
  },
  loginSubtitle: {
    color: '#475569',
    marginTop: 4,
    fontWeight: '600',
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 14,
    shadowColor: '#1e3a8a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeOk: {
    backgroundColor: '#dcfce7',
  },
  badgeDown: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 11,
    color: '#0f172a',
  },
});
