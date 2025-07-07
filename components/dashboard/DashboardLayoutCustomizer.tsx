'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { TrackedProductsGrid } from './TrackedProductsGrid';
import { WishlistManager } from './WishlistManager';
import { SavingsCalculator } from './SavingsCalculator';
import { PriceHistoryChart } from './PriceHistoryChart';

export type WidgetType = 
  | 'account-info'
  | 'subscription-info'
  | 'usage-stats'
  | 'tracked-products'
  | 'wishlist'
  | 'savings-calculator'
  | 'price-history'
  | 'quick-actions';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  visible: boolean;
  order: number;
}

export interface DashboardLayout {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  isDefault?: boolean;
}

interface DashboardLayoutCustomizerProps {
  clerkUser: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    emailAddresses: Array<{
      emailAddress: string;
      verification?: {
        status: string;
      };
    }>;
  };
  mongoUser: {
    _id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    subscription?: {
      plan: string;
      status: string;
      stripeCustomerId?: string;
    } | null;
    usage?: {
      productsTracked: number;
      maxProducts: number;
      emailsSent: number;
      maxEmails: number;
    } | null;
    role?: string;
    lastLoginAt?: string;
    loginCount?: number;
  } | null;
  onLayoutChange?: (layout: DashboardLayout) => void;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: 'account-info',
    type: 'account-info',
    title: 'Informații Cont',
    size: 'medium',
    visible: true,
    order: 0
  },
  {
    id: 'subscription-info',
    type: 'subscription-info',
    title: 'Abonament',
    size: 'medium',
    visible: true,
    order: 1
  },
  {
    id: 'usage-stats',
    type: 'usage-stats',
    title: 'Utilizare',
    size: 'medium',
    visible: true,
    order: 2
  },
  {
    id: 'savings-calculator',
    type: 'savings-calculator',
    title: 'Calculator Economii',
    size: 'large',
    visible: true,
    order: 3
  },
  {
    id: 'tracked-products',
    type: 'tracked-products',
    title: 'Produse Urmărite',
    size: 'full',
    visible: true,
    order: 4
  },
  {
    id: 'wishlist',
    type: 'wishlist',
    title: 'Wishlist',
    size: 'full',
    visible: true,
    order: 5
  },
  {
    id: 'quick-actions',
    type: 'quick-actions',
    title: 'Acțiuni Rapide',
    size: 'large',
    visible: true,
    order: 6
  }
];

const LAYOUT_PRESETS: DashboardLayout[] = [
  {
    id: 'default',
    name: 'Standard',
    description: 'Layout-ul implicit cu toate widget-urile vizibile',
    widgets: [...DEFAULT_WIDGETS],
    isDefault: true
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Layout compact pentru utilizatori avansați',
    widgets: DEFAULT_WIDGETS.map((widget: DashboardWidget) => ({
      ...widget,
      size: (widget.size === 'full' ? 'large' : widget.size === 'large' ? 'medium' : 'small') as WidgetSize
    }))
  },
  {
    id: 'tracking-focused',
    name: 'Focalizat pe Urmărire',
    description: 'Optimizat pentru gestionarea produselor urmărite',
    widgets: DEFAULT_WIDGETS.map((widget: DashboardWidget) => ({
      ...widget,
      visible: ['tracked-products', 'price-history', 'account-info', 'usage-stats'].includes(widget.type)
    }))
  },
  {
    id: 'analytics-focused',
    name: 'Focalizat pe Analize',
    description: 'Optimizat pentru analize și economii',
    widgets: DEFAULT_WIDGETS.map((widget: DashboardWidget) => ({
      ...widget,
      visible: ['savings-calculator', 'price-history', 'usage-stats', 'subscription-info'].includes(widget.type)
    }))
  }
];

export function DashboardLayoutCustomizer({ clerkUser, mongoUser, onLayoutChange }: DashboardLayoutCustomizerProps) {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout>(LAYOUT_PRESETS[0]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([...DEFAULT_WIDGETS]);

  // Load user preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLayout = localStorage.getItem('dashboard-layout');
      if (savedLayout) {
        try {
          const parsed = JSON.parse(savedLayout);
          setCurrentLayout(parsed);
          setWidgets(parsed.widgets);
        } catch (error) {
          console.error('Failed to parse saved layout:', error);
        }
      }
    }
  }, []);

  // Save layout to localStorage and call onChange
  const saveLayout = useCallback((layout: DashboardLayout) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-layout', JSON.stringify(layout));
    }
    onLayoutChange?.(layout);
  }, [onLayoutChange]);

  // Handle drag end
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newWidgets = [...widgets];
    const [reorderedWidget] = newWidgets.splice(result.source.index, 1);
    newWidgets.splice(result.destination.index, 0, reorderedWidget);

    // Update order
    const updatedWidgets = newWidgets.map((widget, index) => ({
      ...widget,
      order: index
    }));

    setWidgets(updatedWidgets);
    
    const updatedLayout = {
      ...currentLayout,
      widgets: updatedWidgets
    };
    setCurrentLayout(updatedLayout);
    saveLayout(updatedLayout);
  };

  // Toggle widget visibility
  const toggleWidgetVisibility = (widgetId: string) => {
    const updatedWidgets = widgets.map((widget) =>
      widget.id === widgetId
        ? { ...widget, visible: !widget.visible }
        : widget
    );
    
    setWidgets(updatedWidgets);
    
    const updatedLayout = {
      ...currentLayout,
      widgets: updatedWidgets
    };
    setCurrentLayout(updatedLayout);
    saveLayout(updatedLayout);
  };

  // Change widget size
  const changeWidgetSize = (widgetId: string, size: WidgetSize) => {
    const updatedWidgets = widgets.map((widget) =>
      widget.id === widgetId
        ? { ...widget, size }
        : widget
    );
    
    setWidgets(updatedWidgets);
    
    const updatedLayout = {
      ...currentLayout,
      widgets: updatedWidgets
    };
    setCurrentLayout(updatedLayout);
    saveLayout(updatedLayout);
  };

  // Apply preset layout
  const applyPreset = (preset: DashboardLayout) => {
    setCurrentLayout(preset);
    setWidgets([...preset.widgets]);
    saveLayout(preset);
    setIsCustomizing(false);
  };

  // Reset to default layout
  const resetToDefault = () => {
    const defaultLayout = LAYOUT_PRESETS[0];
    setCurrentLayout(defaultLayout);
    setWidgets([...defaultLayout.widgets]);
    saveLayout(defaultLayout);
  };

  // Get widget size classes
  const getWidgetSizeClasses = (size: WidgetSize) => {
    switch (size) {
      case 'small':
        return 'col-span-1';
      case 'medium':
        return 'col-span-1 lg:col-span-1';
      case 'large':
        return 'col-span-1 lg:col-span-2';
      case 'full':
        return 'col-span-1 lg:col-span-3';
      default:
        return 'col-span-1';
    }
  };

  // Render widget content
  const renderWidgetContent = (widget: DashboardWidget) => {
    switch (widget.type) {
      case 'account-info':
        return (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Informații Cont
            </h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Email:</span> {clerkUser.emailAddresses[0]?.emailAddress}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Nume:</span> {clerkUser.firstName} {clerkUser.lastName}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Verificat:</span> {
                  clerkUser.emailAddresses[0]?.verification?.status === 'verified' 
                    ? '✅ Da' 
                    : '❌ Nu'
                }
              </p>
            </div>
          </div>
        );

      case 'subscription-info':
        return (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Abonament
            </h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Plan:</span> {
                  mongoUser?.subscription?.plan ? 
                  mongoUser.subscription.plan.toUpperCase() : 
                  'FREE'
                }
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Status:</span> {
                  mongoUser?.subscription?.status ? 
                  mongoUser.subscription.status.toUpperCase() : 
                  'ACTIVE'
                }
              </p>
            </div>
          </div>
        );

      case 'usage-stats':
        return (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Utilizare
            </h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Produse urmărite:</span> {
                  mongoUser?.usage?.productsTracked || 0
                } / {
                  mongoUser?.usage?.maxProducts || 5
                }
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Email-uri trimise:</span> {
                  mongoUser?.usage?.emailsSent || 0
                } / {
                  mongoUser?.usage?.maxEmails || 10
                }
              </p>
            </div>
          </div>
        );

      case 'savings-calculator':
        return <SavingsCalculator />;

      case 'tracked-products':
        return (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Produse Urmărite
            </h3>
            <TrackedProductsGrid />
          </div>
        );

      case 'wishlist':
        return (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Wishlist
            </h3>
            <WishlistManager />
          </div>
        );

      case 'quick-actions':
        return (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Acțiuni Rapide
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <a
                href="/produse"
                className="block rounded-lg bg-primary px-4 py-3 text-center text-white shadow hover:bg-primary/90 transition-colors"
              >
                Explorează Produse
              </a>
              <a
                href="/customer-portal"
                className="block rounded-lg bg-green-600 px-4 py-3 text-center text-white shadow hover:bg-green-700 transition-colors"
              >
                Gestionează Abonament
              </a>
            </div>
          </div>
        );

      default:
        return <div className="p-6">Widget necunoscut</div>;
    }
  };

  const visibleWidgets = widgets.filter((widget) => widget.visible).sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header with customization controls */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Bună ziua, {clerkUser.firstName || 'Utilizator'}! 👋
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Gestionează produsele urmărite și personalizează dashboard-ul
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsCustomizing(!isCustomizing)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCustomizing
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {isCustomizing ? 'Termină Personalizarea' : 'Personalizează Layout'}
              </button>
            </div>
          </div>

          {/* Customization panel */}
          {isCustomizing && (
            <div className="mt-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Opțiuni de Personalizare
              </h3>
              
              {/* Preset layouts */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Layout-uri Predefinite
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {LAYOUT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className={`p-3 text-left rounded-lg border transition-colors ${
                        currentLayout.id === preset.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-300 dark:border-gray-600 hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{preset.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Widget visibility controls */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Vizibilitatea Widget-urilor
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {widgets.map((widget) => (
                    <label key={widget.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={widget.visible}
                        onChange={() => toggleWidgetVisibility(widget.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {widget.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Reset button */}
              <div className="flex justify-end">
                <button
                  onClick={resetToDefault}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Resetează la Default
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard widgets */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="dashboard">
            {(provided: DroppableProvided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {visibleWidgets.map((widget, index) => (
                  <Draggable
                    key={widget.id}
                    draggableId={widget.id}
                    index={index}
                    isDragDisabled={!isCustomizing}
                  >
                    {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`${getWidgetSizeClasses(widget.size)} ${
                          snapshot.isDragging ? 'opacity-75' : ''
                        } ${isCustomizing ? 'ring-2 ring-primary/20' : ''}`}
                      >
                        <div className="h-full bg-white dark:bg-gray-800 rounded-lg shadow relative">
                          {isCustomizing && (
                            <div className="absolute top-2 right-2 z-10 flex space-x-1">
                              {/* Size controls */}
                              <select
                                value={widget.size}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => changeWidgetSize(widget.id, e.target.value as WidgetSize)}
                                className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5"
                              >
                                <option value="small">Mic</option>
                                <option value="medium">Mediu</option>
                                <option value="large">Mare</option>
                                <option value="full">Complet</option>
                              </select>
                              {/* Drag handle */}
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-move p-1 bg-gray-100 dark:bg-gray-600 rounded"
                              >
                                <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </div>
                            </div>
                          )}
                          {renderWidgetContent(widget)}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}