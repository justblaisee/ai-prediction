"use client";

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { predictionsApi, productsApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';

export default function PredictionsPage() {
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.list({ limit: 100 }),
  });

  const { data: predictionsData, isLoading: predictionsLoading, refetch } = useQuery({
    queryKey: ['predictions', selectedProduct],
    queryFn: () => predictionsApi.getForProduct(selectedProduct, 90),
    enabled: !!selectedProduct,
  });

  const { data: stockoutData } = useQuery({
    queryKey: ['stockout', selectedProduct],
    queryFn: () => predictionsApi.getStockout(selectedProduct),
    enabled: !!selectedProduct,
  });

  const { data: trainStatusData, refetch: refetchTrainStatus } = useQuery({
    queryKey: ['train-status', selectedProduct],
    queryFn: () => predictionsApi.getTrainStatus(selectedProduct),
    enabled: !!selectedProduct,
    refetchInterval: (query) => {
      const status = (query.state.data as { data?: { status?: string } } | undefined)?.data?.status;
      return status === 'running' ? 1500 : false;
    },
  });

  const trainMutation = useMutation({
    mutationFn: (productId: string) => predictionsApi.train(productId),
    onSuccess: () => {
      toast.success('Training started');
      refetchTrainStatus();
    },
    onError: () => {
      toast.error('Training failed');
    },
  });

  const products = productsData?.data?.products || [];
  const predictionsPayload = predictionsData?.data;
  const predictions = Array.isArray(predictionsPayload)
    ? predictionsPayload
    : predictionsPayload?.predictions || [];
  const stockout = stockoutData?.data;
  const trainStatus = trainStatusData?.data;
  const previousStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const currentStatus = trainStatus?.status;
    if (previousStatus === 'running' && currentStatus === 'completed') {
      toast.success('Training completed');
      refetch();
    }
    if (previousStatus === 'running' && currentStatus === 'failed') {
      toast.error(trainStatus?.error || 'Training failed');
    }
    previousStatusRef.current = currentStatus;
  }, [trainStatus, refetch]);

  const isTraining = trainStatus?.status === 'running' || trainMutation.isPending;

  const chartData = predictions.map((p: any) => ({
    date: new Date(p.predictedDate).toLocaleDateString(),
    predicted: p.predictedQty,
    lower: p.confidenceMin || p.predictedQty * 0.8,
    upper: p.confidenceMax || p.predictedQty * 1.2,
  }));

  const estimatedStockoutDate = stockout?.estimatedStockoutDate ?? stockout?.stockoutDate ?? null;
  const daysLeft = stockout?.daysLeft ?? stockout?.daysUntilStockout ?? null;
  const avgDailyDemand =
    stockout?.avgDailyDemand ??
    (predictions.length > 0
      ? predictions.reduce((sum: number, p: any) => sum + Number(p.predictedQty || 0), 0) / predictions.length
      : null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Demand Predictions</h1>
          <p className="text-muted-foreground mt-2">AI-powered demand forecasting</p>
        </div>
      </div>

      {/* Product Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Product</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="">Select a product...</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            <Button
              onClick={() => selectedProduct && trainMutation.mutate(selectedProduct)}
              disabled={!selectedProduct || isTraining}
            >
              {isTraining ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isTraining ? `Training ${trainStatus?.progress ?? 10}%` : 'Train Model'}
            </Button>
          </div>
          {selectedProduct && trainStatus && (
            <div className="mt-4 flex items-center gap-3">
              <Badge
                variant={
                  trainStatus.status === 'completed'
                    ? 'default'
                    : trainStatus.status === 'failed'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {trainStatus.status.toUpperCase()}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {trainStatus.message}
                {trainStatus.error ? ` (${trainStatus.error})` : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProduct && (
        <>
          {/* Stockout Info */}
          {stockout && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className={daysLeft !== null && daysLeft <= 7 ? 'border-destructive' : ''}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <AlertTriangle
                        className={`h-10 w-10 ${
                          daysLeft !== null && daysLeft <= 7 ? 'text-destructive' : 'text-yellow-500'
                        }`}
                      />
                      <div>
                        <p className="text-sm text-muted-foreground">Est. Stockout Date</p>
                        <p className="text-2xl font-bold">
                          {estimatedStockoutDate
                            ? new Date(estimatedStockoutDate).toLocaleDateString()
                            : 'No stockout'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {daysLeft !== null ? `${daysLeft} days left` : 'Stock is sufficient'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-blue-500">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Daily Demand</p>
                        <p className="text-2xl font-bold">
                          {avgDailyDemand !== null ? `${avgDailyDemand.toFixed(1)} units` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-green-500">
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Confidence</p>
                        <p className="text-2xl font-bold">
                          {typeof stockout.confidence === 'number'
                            ? `${(stockout.confidence * 100).toFixed(0)}%`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {/* Forecast Chart */}
          <Card>
            <CardHeader>
              <CardTitle>90-Day Demand Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              {predictionsLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : predictions.length > 0 ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
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
                        dataKey="predicted"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={false}
                        name="Predicted Demand"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  No predictions available. Train the model to generate forecasts.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
