"use client";

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { productsApi } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct?: any;
  onSuccess: () => void;
}

export function ProductModal({ isOpen, onClose, editingProduct, onSuccess }: ProductModalProps) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    currentStock: 0,
    minThreshold: 10,
    leadTimeDays: 7,
    unitPrice: 0,
    category: '',
  });

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        sku: editingProduct.sku || '',
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        currentStock: editingProduct.currentStock || 0,
        minThreshold: editingProduct.minThreshold || 10,
        leadTimeDays: editingProduct.leadTimeDays || 7,
        unitPrice: editingProduct.unitPrice || 0,
        category: editingProduct.category || '',
      });
    } else {
      setFormData({
        sku: '',
        name: '',
        description: '',
        currentStock: 0,
        minThreshold: 10,
        leadTimeDays: 7,
        unitPrice: 0,
        category: '',
      });
    }
  }, [editingProduct, isOpen]);

  const createMutation = useMutation({
    mutationFn: (data: any) => productsApi.create(data),
    onSuccess: () => {
      toast.success('Product created successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.update(id, data),
    onSuccess: () => {
      toast.success('Product updated successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update product');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sku || !formData.name) {
      toast.error('SKU and Name are required');
      return;
    }

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">SKU *</label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="e.g., PROD-001"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Electronics"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Product Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product name"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Current Stock</label>
                <Input
                  type="number"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Min Threshold</label>
                <Input
                  type="number"
                  value={formData.minThreshold}
                  onChange={(e) => setFormData({ ...formData, minThreshold: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Lead Time (days)</label>
                <Input
                  type="number"
                  value={formData.leadTimeDays}
                  onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Unit Price</label>
                <Input
                  type="number"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {editingProduct ? 'Update Product' : 'Create Product'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
