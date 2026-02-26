"use client";

import { useQuery } from '@tanstack/react-query';
import { productsApi, predictionsApi, alertsApi } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
}

function KPICard({ title, value, change, icon: Icon, color }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold mt-2">{value}</p>
              {change !== undefined && (
                <div className="flex items-center mt-2">
                  {change >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span
                    className={`text-sm ${
                      change >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {Math.abs(change)}%
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">vs last week</span>
                </div>
              )}
            </div>
            <div className={`p-4 rounded-full ${color}`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.list(),
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.list(),
  });

  const { data: predictionsData } = useQuery({
    queryKey: ['predictions', 'dashboard'],
    queryFn: () => predictionsApi.getDashboardPredictions(),
  });

  const products = productsData?.data?.products || [];
  const alerts = alertsData?.data?.alerts || [];
  const predictions = predictionsData?.data?.predictions || [];

  const totalProducts = products.length;
  const totalStock = products.reduce((sum: number, p: any) => sum + (p.currentStock || 0), 0);
  const lowStockProducts = products.filter((p: any) => p.currentStock < p.minThreshold).length;
  const criticalAlerts = alerts.filter((a: any) => a.severity === 'CRITICAL').length;

  // Mock data for charts (in production, this would come from API)
  const forecastData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    actual: Math.floor(Math.random() * 50) + 20,
    predicted: Math.floor(Math.random() * 50) + 20,
    lower: Math.floor(Math.random() * 30) + 10,
    upper: Math.floor(Math.random() * 30) + 40,
  }));

  const categoryData = products.reduce((acc: any, p: any) => {
    const cat = p.category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryData).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Monitor your inventory and predictions</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Products"
          value={totalProducts}
          change={5}
          icon={Package}
          color="bg-blue-500"
        />
        <KPICard
          title="Total Stock"
          value={totalStock.toLocaleString()}
          change={12}
          icon={DollarSign}
          color="bg-green-500"
        />
        <KPICard
          title="Low Stock Items"
          value={lowStockProducts}
          icon={AlertTriangle}
          color="bg-yellow-500"
        />
        <KPICard
          title="Critical Alerts"
          value={criticalAlerts}
          icon={AlertTriangle}
          color="bg-red-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Forecast Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Demand Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="transparent"
                    fill="url(#colorPredicted)"
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="transparent"
                    fill="hsl(var(--background))"
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    name="Actual"
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#8884d8"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Predicted"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Products by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ fill: '#8884d8', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.slice(0, 5).map((alert: any) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted"
              >
                <div className="flex items-center gap-4">
                  <AlertTriangle
                    className={`h-5 w-5 ${
                      alert.severity === 'CRITICAL'
                        ? 'text-red-500'
                        : alert.severity === 'WARNING'
                        ? 'text-yellow-500'
                        : 'text-blue-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    alert.severity === 'CRITICAL'
                      ? 'destructive'
                      : alert.severity === 'WARNING'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {alert.severity}
                </Badge>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No alerts at this time
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
