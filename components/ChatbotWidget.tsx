'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Script from 'next/script';

export default function ChatbotWidget() {
  const { user, authenticated, getAccessToken } = usePrivy();
  const [privyToken, setPrivyToken] = useState<string | null>(null);

  const userId = user?.id || null;
  const emailAddress =
    user?.email?.address ||
    user?.google?.email ||
    user?.apple?.email ||
    user?.discord?.email ||
    null;

  let displayName = null;
  if (user) {
    if (user.google?.name) {
      displayName = user.google.name;
    } else if (emailAddress) {
      displayName = emailAddress.split('@')[0];
    } else if (user.wallet?.address) {
      const addr = user.wallet.address;
      displayName = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    } else {
      displayName = 'User';
    }
  }

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';
  const isUserAdmin = emailAddress && adminEmail && emailAddress.toLowerCase() === adminEmail.toLowerCase();

  // Fetch Privy access token for the chatbot widget (safe to share externally,
  // unlike the Supabase JWT which is an internal database session token)
  useEffect(() => {
    if (!authenticated) {
      setPrivyToken(null);
      return;
    }
    getAccessToken().then(token => setPrivyToken(token));
  }, [authenticated, getAccessToken]);

  // Initialize the widget config once on mount
  useEffect(() => {
    (window as any).__EMBED_CONFIG__ = {
      publicToken: "h9giikzQeItPPh7d5brU4DfnW1jMe5C1xS4HhT9FJMPLn6SEXYfHoYIZSh9QT3i1",
      getUserToken: function() {
        return document.querySelector("meta[name=user-token]")?.getAttribute("content") || null;
      },
      getUserId: function() {
        return document.querySelector("meta[name=user-id]")?.getAttribute("content") || null;
      },
      getUserName: function() {
        return document.querySelector("meta[name=user-name]")?.getAttribute("content") || null;
      },
      getUserEmail: function() {
        return document.querySelector("meta[name=user-email]")?.getAttribute("content") || null;
      },
      getUserRole: function() {
        return document.querySelector("meta[name=user-role]")?.getAttribute("content") || null;
      }
    };
  }, []);

  // Dynamically update meta tags in <head> based on login state.
  // The widget reads these via the getUserX() functions above.
  useEffect(() => {
    const updateMetaTag = (name: string, value: string | null) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (value) {
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', name);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', value);
      } else {
        if (meta) {
          meta.remove();
        }
      }
    };

    updateMetaTag('user-token', authenticated ? privyToken : null);
    updateMetaTag('user-id', authenticated ? userId : null);
    updateMetaTag('user-name', authenticated ? displayName : null);
    updateMetaTag('user-email', authenticated ? emailAddress : null);
    updateMetaTag('user-role', authenticated ? (isUserAdmin ? "admin" : "user") : null);
  }, [authenticated, privyToken, userId, displayName, emailAddress, isUserAdmin]);

  // Cleanup meta tags on unmount
  useEffect(() => {
    return () => {
      ['user-token', 'user-id', 'user-name', 'user-email', 'user-role'].forEach(name => {
        document.querySelector(`meta[name="${name}"]`)?.remove();
      });
    };
  }, []);

  return (
    <Script
      src="https://xeelaa.com/widget.js?key=h9giikzQeItPPh7d5brU4DfnW1jMe5C1xS4HhT9FJMPLn6SEXYfHoYIZSh9QT3i1"
      strategy="afterInteractive"
    />
  );
}
