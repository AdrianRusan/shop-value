'use server';

import { connectToDB } from '../mongoose';
import PriceAlert from '../models/price-alert.model';
import { revalidatePath } from 'next/cache';

interface CreatePriceAlertData {
  userId: string;
  productId: string;
  email: string;
  alertType: 'target_price' | 'percentage_drop' | 'significant_drop' | 'back_in_stock' | 'any_drop';
  targetPrice?: number;
  percentageThreshold?: number;
  significantDropAmount?: number;
  frequency: 'immediate' | 'daily' | 'weekly';
  maxAlertsPerDay: number;
}

export async function createPriceAlert(data: CreatePriceAlertData) {
  try {
    await connectToDB();

    const newAlert = new PriceAlert({
      userId: data.userId,
      productId: data.productId,
      email: data.email,
      alertType: data.alertType,
      targetPrice: data.targetPrice,
      percentageThreshold: data.percentageThreshold,
      significantDropAmount: data.significantDropAmount,
      frequency: data.frequency,
      maxAlertsPerDay: data.maxAlertsPerDay,
      isActive: true,
      isPaused: false,
    });

    await newAlert.save();

    revalidatePath('/dashboard');
    
    return { success: true, alertId: newAlert._id };
  } catch (error: any) {
    console.error('Error creating price alert:', error);
    throw new Error(`Failed to create price alert: ${error.message}`);
  }
}

export async function getUserPriceAlerts(userId: string) {
  try {
    await connectToDB();

    const alerts = await PriceAlert.findUserAlerts(userId);
    return alerts;
  } catch (error: any) {
    console.error('Error fetching user price alerts:', error);
    throw new Error(`Failed to fetch price alerts: ${error.message}`);
  }
}

export async function togglePriceAlert(alertId: string, isActive: boolean) {
  try {
    await connectToDB();

    const alert = await PriceAlert.findByIdAndUpdate(
      alertId,
      { isActive },
      { new: true }
    );

    if (!alert) {
      throw new Error('Price alert not found');
    }

    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (error: any) {
    console.error('Error toggling price alert:', error);
    throw new Error(`Failed to toggle price alert: ${error.message}`);
  }
}

export async function deletePriceAlert(alertId: string) {
  try {
    await connectToDB();

    const alert = await PriceAlert.findByIdAndDelete(alertId);

    if (!alert) {
      throw new Error('Price alert not found');
    }

    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting price alert:', error);
    throw new Error(`Failed to delete price alert: ${error.message}`);
  }
}