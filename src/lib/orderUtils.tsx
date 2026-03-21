import React from 'react';
import { 
  Clock, 
  CheckCircle2, 
  Package, 
  Truck, 
  CheckCircle, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { OrderStatus } from '../types';

export const getOrderStatusColor = (status: OrderStatus) => {
  switch (status) {
    case 'pending': 
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'confirmed': 
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'processing': 
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'out_for_delivery': 
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'completed': 
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'cancelled': 
      return 'bg-rose-100 text-rose-700 border-rose-200';
    default: 
      return 'bg-stone-100 text-stone-700 border-stone-200';
  }
};

export const getOrderStatusIcon = (status: OrderStatus, className: string = "w-5 h-5") => {
  switch (status) {
    case 'pending': 
      return <Clock className={`${className} text-amber-500`} />;
    case 'confirmed': 
      return <CheckCircle2 className={`${className} text-blue-500`} />;
    case 'processing': 
      return <Package className={`${className} text-indigo-500`} />;
    case 'out_for_delivery': 
      return <Truck className={`${className} text-purple-500`} />;
    case 'completed': 
      return <CheckCircle className={`${className} text-emerald-500`} />;
    case 'cancelled': 
      return <X className={`${className} text-rose-500`} />;
    default: 
      return <AlertCircle className={`${className} text-stone-500`} />;
  }
};
