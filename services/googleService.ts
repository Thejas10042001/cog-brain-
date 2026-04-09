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
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Server returned ${response.status}: ${text.slice(0, 100)}`);
    }
    try {
      const data = await response.json();
      return data.isAuthenticated;
    } catch (e) {
      const text = await response.text();
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }
  },

  async getAccessToken(): Promise<string> {
    const response = await fetch('/api/auth/google/token');
    if (!response.ok) throw new Error('Failed to fetch token');
    const data = await response.json();
    return data.access_token;
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
  },

  async downloadDriveFile(fileId: string): Promise<Blob> {
    const response = await fetch(`/api/drive/download/${fileId}`);
    if (!response.ok) throw new Error('Failed to download file');
    return response.blob();
  }
};
