import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { rideApi } from '@/lib/api';
import { RideMessage } from '@/lib/types';
import { emitRideMessage, getSocket, RideMessageEvent } from '@/lib/socket-service';
import { MessageSquare, Send } from 'lucide-react';

interface RideChatPanelProps {
  rideId: string | null;
  userRole: 'client' | 'driver' | 'admin';
}

const RideChatPanel = ({ rideId, userRole }: RideChatPanelProps) => {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!rideId) {
      setMessages([]);
      return;
    }

    rideApi.getMessages(rideId)
      .then((res) => setMessages(res.data.messages || []))
      .catch(() => setMessages([]));
  }, [rideId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMessage = (event: RideMessageEvent) => {
      if (event.rideId !== rideId) return;
      setMessages((prev) => [...prev, event.message]);
    };

    socket.on('ride:message', handleMessage);
    return () => {
      socket.off('ride:message', handleMessage);
    };
  }, [rideId]);

  const handleSend = async () => {
    if (!rideId || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      emitRideMessage(rideId, text);
      const socket = getSocket();
      if (!socket?.connected) {
        const res = await rideApi.sendMessage(rideId, text);
        setMessages((prev) => [...prev, res.data.message]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Ride Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">Use live chat to coordinate pickup details, landmarks, or delays.</p>
          )}
          {messages.map((message, index) => {
            const mine = (userRole === 'client' && message.senderType === 'user') || (userRole === 'driver' && message.senderType === 'driver');
            return (
              <div key={`${message.createdAt}-${index}`} className={`rounded-xl border px-3 py-2 text-sm ${mine ? 'bg-primary/5 border-primary/20 ml-6' : 'bg-muted/30 mr-6'}`}>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mb-1">
                  <span className="capitalize">{message.senderType}</span>
                  <span>{new Date(message.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p>{message.text}</p>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message about pickup, landmark, or ETA" onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }} />
          <Button type="button" onClick={handleSend} disabled={sending || !rideId || !draft.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RideChatPanel;
