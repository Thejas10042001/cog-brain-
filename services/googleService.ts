
export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  description?: string;
}

export const googleService = {
  async getAuthUrl(): Promise<string> {
    const response = await fetch('/api/auth/google/url');
    const data = await response.json();
    return data.url;
  },

  async getAuthStatus(): Promise<boolean> {
    const response = await fetch('/api/auth/status');
    const data = await response.json();
    return data.isAuthenticated;
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
  },

  async getUpcomingEvents(): Promise<CalendarEvent[]> {
    const response = await fetch('/api/calendar/upcoming');
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  },

  async sendReport(to: string, subject: string, body: string): Promise<void> {
    const response = await fetch('/api/gmail/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    });
    if (!response.ok) throw new Error('Failed to send report');
  }
};
