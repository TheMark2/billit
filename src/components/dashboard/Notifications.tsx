"use client";

import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconBell, IconBellFilled, IconReceipt, IconCheck, IconX } from "@tabler/icons-react";
import { supabase } from "@/lib/supabaseClient";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'payment' | 'subscription' | 'integration' | 'limit' | 'welcome';
  created_at: string;
  is_read: boolean;
  action_url?: string;
  receipt_id?: string;
  metadata?: any;
}

interface NotificationsProps {
  onToggle?: (isOpen: boolean) => void;
}

// Skeleton para las notificaciones
const NotificationsSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 3 }, (_, i) => (
      <div key={i} className="p-4 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 bg-neutral-200 rounded-full mt-1.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-neutral-200 rounded w-32" />
              <div className="h-3 bg-neutral-100 rounded w-12" />
            </div>
            <div className="h-3 bg-neutral-100 rounded w-48" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export function Notifications({ onToggle }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Temporalmente deshabilitado hasta que se cree la tabla notifications
    // fetchNotifications();
    setLoading(false);
  }, []);

  const fetchNotifications = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
    // Obtener notificaciones reales de la base de datos
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      setHasUnread(false);
      return;
    }

    if (notifications) {
      setNotifications(notifications);
      setHasUnread(notifications.some(n => !n.is_read));
    }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      setHasUnread(false);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    
    if (!uid) return;

    // Actualizar en la base de datos
    await supabase.rpc('mark_notifications_as_read', {
      p_user_id: uid,
      p_notification_ids: [id]
    });

    // Actualizar estado local
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    setHasUnread(notifications.some(n => !n.is_read && n.id !== id));
  };

  const markAllAsRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    
    if (!uid) return;

    // Actualizar en la base de datos
    await supabase.rpc('mark_notifications_as_read', {
      p_user_id: uid,
      p_notification_ids: null
    });

    // Actualizar estado local
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setHasUnread(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'error': return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      case 'warning': return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
      case 'payment': return <div className="w-2 h-2 bg-orange-500 rounded-full" />;
      case 'subscription': return <div className="w-2 h-2 bg-purple-500 rounded-full" />;
      case 'integration': return <div className="w-2 h-2 bg-cyan-500 rounded-full" />;
      case 'limit': return <div className="w-2 h-2 bg-red-400 rounded-full" />;
      case 'welcome': return <div className="w-2 h-2 bg-emerald-500 rounded-full" />;
      default: return <div className="w-2 h-2 bg-blue-500 rounded-full" />;
    }
  };

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    onToggle?.(open);
    
    if (open && hasUnread) {
      // Marcar todas como leídas al abrir
      setTimeout(() => markAllAsRead(), 1000);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleToggle}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors duration-200"
        >
          {hasUnread ? (
            <IconBellFilled className="h-5 w-5 text-neutral-500" />
          ) : (
            <IconBell className="h-5 w-5 text-neutral-500" />
          )}
          
          {hasUnread && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0 ml-4" align="start">
        <div className="p-4 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs text-neutral-500 hover:text-neutral-700"
                >
                  <IconCheck className="w-3 h-3 mr-1" />
                  Marcar todas como leídas
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="p-1 h-6 w-6 text-neutral-400 hover:text-neutral-600"
              >
                <IconX className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <NotificationsSkeleton />
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <IconBell className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-sm text-neutral-500">No hay notificaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-neutral-50 transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {notification.title}
                        </p>
                        <span className="text-xs text-neutral-500 whitespace-nowrap ml-2">
                          {formatTimeAgo(new Date(notification.created_at))}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1 truncate">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        

      </PopoverContent>
    </Popover>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Ahora';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
  
  return date.toLocaleDateString();
} 