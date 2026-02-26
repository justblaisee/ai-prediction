import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { clearTokens, mobileApi, saveTokens } from './src/lib/api';
import { Product, TrainStatus, User } from './src/types';

type Session = {
  user: User;
  organizationName: string;
};

export default function App(): JSX.Element {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('admin@startup.test');
  const [password, setPassword] = useState('StartUp123!');
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [trainStatus, setTrainStatus] = useState<TrainStatus | null>(null);

  useEffect(() => {
    void (async () => {
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
          // ignored during polling
        }
      })();
    }, 1500);
    return () => clearInterval(timer);
  }, [selectedProduct, trainStatus?.status]);

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
  }

  async function trainNow(): Promise<void> {
    if (!selectedProduct) return;
    setError(null);
    try {
      await mobileApi.train(selectedProduct.id);
      const status = await mobileApi.trainStatus(selectedProduct.id);
      setTrainStatus(status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start training');
    }
  }

  const running = useMemo(() => trainStatus?.status === 'running', [trainStatus?.status]);

  if (booting) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Booting mobile app...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginCard}>
          <Text style={styles.title}>Inventory AI Mobile</Text>
          <Text style={styles.subtitle}>Login to continue</Text>

          <TextInput style={styles.input} autoCapitalize="none" placeholder="Email" value={email} onChangeText={setEmail} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.button} onPress={() => void login()}>
            <Text style={styles.buttonText}>Login</Text>
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
            {session.organizationName} • {session.user.firstName}
          </Text>
        </View>
        <Pressable style={styles.outlineButton} onPress={() => void logout()}>
          <Text>Logout</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Products ({products.length})</Text>
        {loadingProducts ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.productItem, selectedProduct?.id === item.id ? styles.productSelected : null]}
                onPress={() => setSelectedProduct(item)}
              >
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.muted}>
                  {item.sku} • stock {item.currentStock}/{item.minThreshold}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Training</Text>
        <Text style={styles.muted}>Selected: {selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : '-'}</Text>
        <Pressable style={[styles.button, running ? styles.buttonDisabled : null]} onPress={() => void trainNow()} disabled={running}>
          <Text style={styles.buttonText}>{running ? 'Training...' : 'Train Model'}</Text>
        </Pressable>
        {trainStatus ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status: {trainStatus.status.toUpperCase()}</Text>
            <Text style={styles.muted}>{trainStatus.message}</Text>
            <Text style={styles.muted}>Progress: {trainStatus.progress}%</Text>
            {trainStatus.error ? <Text style={styles.error}>{trainStatus.error}</Text> : null}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    marginTop: 2,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0f172a',
  },
  list: {
    maxHeight: 280,
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
    fontWeight: '600',
    color: '#0f172a',
  },
  muted: {
    color: '#64748b',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  loginCard: {
    marginTop: 80,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    backgroundColor: 'white',
  },
  statusCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#f8fafc',
  },
  statusLabel: {
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  error: {
    color: '#dc2626',
    marginTop: 8,
  },
});
