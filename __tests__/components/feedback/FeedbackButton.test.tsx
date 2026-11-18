/**
 * The one Feedback button: the message it emails, the screen recording it can send instead (which
 * path a browser gets, what is sent), and that it sits in its own element under <body> (which is
 * what keeps it usable over Privy's funding window).
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import FeedbackButton, { BOOK_A_DEMO_URL } from '@/components/feedback/FeedbackButton';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { sendRecording } from '@/lib/recordingUpload';
import { usePartnerBrand } from '@conduit-ucpi/whitelabel-sdk';

jest.mock('@/components/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/components/auth/ConfigProvider', () => ({ useConfig: jest.fn() }));
jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({ ...jest.requireActual('@conduit-ucpi/whitelabel-sdk'), usePartnerBrand: jest.fn() }));
jest.mock('next/router', () => ({ useRouter: () => ({ pathname: '/contract-pay' }) }));
jest.mock('@/lib/recordingUpload', () => ({
  ...jest.requireActual('@/lib/recordingUpload'),
  sendRecording: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockSend = sendRecording as jest.MockedFunction<typeof sendRecording>;
const mockPartnerBrand = usePartnerBrand as jest.MockedFunction<typeof usePartnerBrand>;
const authenticatedFetch = jest.fn();

const live = (on: boolean) => mockUseConfig.mockReturnValue({ config: { problemRecordingsLive: on, gitSha: 'abc1234' } } as any);
const video = (name = 'RPReplay.mov', type = 'video/quicktime') => new File(['frames'], name, { type });
const openFeedback = () => fireEvent.click(screen.getByRole('button', { name: 'Send us feedback' }));
/** Through the message form to the recording. */
const open = () => {
  openFeedback();
  fireEvent.click(screen.getByRole('button', { name: 'Show us with a screen recording' }));
};
const choose = (file: File) => fireEvent.change(screen.getByLabelText('Upload recording', { selector: 'input' }), { target: { files: [file] } });

/** A browser that can record its screen, and the recorder it would use. */
function recordingBrowser(getDisplayMedia: jest.Mock) {
  const instances: any[] = [];
  class FakeRecorder {
    static isTypeSupported = (type: string) => type === 'video/webm';
    state = 'inactive';
    mimeType: string;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(_stream: unknown, options?: { mimeType?: string }) {
      this.mimeType = options?.mimeType ?? '';
      instances.push(this);
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['frames'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  (global as any).MediaRecorder = FakeRecorder;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia } });
  return instances;
}
const stream = (surface: string = 'monitor') => {
  const track = { stop: jest.fn(), addEventListener: jest.fn(), getSettings: () => ({ displaySurface: surface }) };
  return { getTracks: () => [track], getVideoTracks: () => [track], track };
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  delete (global as any).MediaRecorder;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  (URL as any).createObjectURL = jest.fn(() => 'blob:preview');
  (URL as any).revokeObjectURL = jest.fn();
  mockUseAuth.mockReturnValue({ user: null, authenticatedFetch } as any);
  mockSend.mockResolvedValue('rec-1');
  authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ sent: true }) });
  mockPartnerBrand.mockReturnValue(null);
  live(true);
});

it('offers no recording where the environment has nowhere to send recordings, but still takes a message', () => {
  live(false);
  render(<FeedbackButton />);
  openFeedback();
  expect(screen.getByLabelText('Message')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Show us with a screen recording' })).toBeNull();
});

it('sits in its own element directly under <body>, above every other layer', () => {
  render(<FeedbackButton />);
  const host = document.getElementById('problem-report-root')!;
  expect(host.parentElement).toBe(document.body);
  expect(host.style.zIndex).toBe('2147483647');
  expect(host.contains(screen.getByRole('button', { name: 'Send us feedback' }))).toBe(true);
});

describe('a message', () => {
  it('emails the message and page, with no account fields', async () => {
    render(<FeedbackButton />);
    openFeedback();
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '  It broke  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText(/your message is on its way/);
    const [path, init] = authenticatedFetch.mock.calls[0];
    expect(path).toBe('/api/in-app-feedback');
    expect(JSON.parse(init.body)).toEqual({ contactEmail: 'ana@example.com', message: 'It broke', pageUrl: window.location.href });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('starts from the signed-in account email', () => {
    mockUseAuth.mockReturnValue({ user: { email: 'ana.account@example.com', walletAddress: '0xabc' }, authenticatedFetch } as any);
    render(<FeedbackButton />);
    openFeedback();
    expect(screen.getByLabelText('Your email')).toHaveValue('ana.account@example.com');
  });

  it('sends nothing until there is an email and a message', () => {
    render(<FeedbackButton />);
    openFeedback();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Enter your email address, so we can reply.')).toBeInTheDocument();
    expect(screen.getByText('Write a message.')).toBeInTheDocument();
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it("shows the server's reason when sending fails", async () => {
    authenticatedFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Too many messages from here. Try again in an hour.' }) });
    render(<FeedbackButton />);
    openFeedback();
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many messages'));
  });

  it('carries what was typed into the recording, and back again', () => {
    mockUseAuth.mockReturnValue({ user: { email: 'ana@example.com' }, authenticatedFetch } as any);
    render(<FeedbackButton />);
    openFeedback();
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Paying by card' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show us with a screen recording' }));
    expect(screen.getByRole('dialog', { name: 'Report a problem' })).toBeInTheDocument();
    choose(video());
    expect(screen.getByLabelText('What were you trying to do?')).toHaveValue('Paying by card');

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Message')).toHaveValue('Paying by card');
  });

  it('offers our booking page, in a new tab, but not on a partner page', () => {
    const first = render(<FeedbackButton />);
    openFeedback();
    const link = screen.getByRole('link', { name: 'Book a demo or a call with us' });
    expect(link).toHaveAttribute('href', BOOK_A_DEMO_URL);
    expect(link).toHaveAttribute('target', '_blank');
    first.unmount();
    window.sessionStorage.clear();

    mockPartnerBrand.mockReturnValue({ name: 'Partner' } as any);
    render(<FeedbackButton />);
    openFeedback();
    expect(screen.queryByRole('link', { name: 'Book a demo or a call with us' })).toBeNull();
  });
});

describe('a browser that cannot record its screen', () => {
  it('explains the phone recorder, warns, and takes a video from the library (not the camera)', () => {
    render(<FeedbackButton />);
    open();
    expect(screen.getByText(/open Control Centre and tap Screen Recording/)).toBeInTheDocument();
    expect(screen.getByText(/open Quick Settings and tap Screen record/)).toBeInTheDocument();
    expect(screen.getByText(/Do not show card numbers or passwords/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start recording' })).toBeNull();
    const input = screen.getByLabelText('Upload recording', { selector: 'input' });
    expect(input).toHaveAttribute('accept', 'video/*');
    expect(input).not.toHaveAttribute('capture');
  });

  it('sends the chosen file with the description and the page context', async () => {
    mockUseAuth.mockReturnValue({ user: { email: 'ana@example.com', walletAddress: '0xabc' }, authenticatedFetch } as any);
    render(<FeedbackButton />);
    open();
    const file = video();
    choose(file);
    fireEvent.change(screen.getByLabelText('What were you trying to do?'), { target: { value: ' Paying by card ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText(/we have your recording/);
    const sent = mockSend.mock.calls[0][0];
    expect(sent.api).toBe(authenticatedFetch);
    expect(sent.file).toBe(file);
    expect(sent.request).toMatchObject({
      contentType: 'video/quicktime',
      size: file.size,
      description: 'Paying by card',
      contactEmail: 'ana@example.com',
      source: 'upload',
      route: '/contract-pay',
      pageUrl: window.location.href,
      appVersion: 'abc1234',
      connectedWallet: '0xabc',
    });
    expect(Array.isArray(sent.request.console)).toBe(true);
  });

  it('refuses a file that is not a video, and sends nothing without an email to reply to', async () => {
    render(<FeedbackButton />);
    open();
    choose(new File(['x'], 'notes.pdf', { type: 'application/pdf' }));
    expect(screen.getByRole('alert')).toHaveTextContent('That file is not a video');

    choose(video());
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Enter your email address, so we can reply.')).toBeInTheDocument();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('keeps the recording and says why when sending fails', async () => {
    mockUseAuth.mockReturnValue({ user: { email: 'ana@example.com' }, authenticatedFetch } as any);
    mockSend.mockRejectedValue(new Error('offline'));
    render(<FeedbackButton />);
    open();
    choose(video());
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your recording could not be sent');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('is still open, with what was typed, after leaving for the recorder and the tab reloading', () => {
    const first = render(<FeedbackButton />);
    open();
    choose(video());
    fireEvent.change(screen.getByLabelText('What were you trying to do?'), { target: { value: 'Paying by card' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    first.unmount();

    render(<FeedbackButton />);
    expect(screen.getByRole('dialog', { name: 'Report a problem' })).toBeInTheDocument();
    choose(video());
    expect(screen.getByLabelText('What were you trying to do?')).toHaveValue('Paying by card');
  });
});

describe('a browser that can record its screen', () => {
  it('records the tab without audio, shows a stop control, then previews before sending', async () => {
    const media = stream();
    const getDisplayMedia = jest.fn(async () => media);
    const recorders = recordingBrowser(getDisplayMedia);
    mockUseAuth.mockReturnValue({ user: { email: 'ana@example.com' }, authenticatedFetch } as any);
    render(<FeedbackButton />);
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    });

    expect(getDisplayMedia).toHaveBeenCalledWith({ video: { frameRate: 15, displaySurface: 'monitor' }, audio: false });
    expect(recorders[0].mimeType).toBe('video/webm');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Stop recording/ }));
    await screen.findByLabelText('What were you trying to do?');
    expect(media.track.stop).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(mockSend).toHaveBeenCalled());
    expect(mockSend.mock.calls[0][0].request).toMatchObject({ source: 'recorder', contentType: 'video/webm', captured: 'monitor' });
    expect(screen.queryByText(/Only this tab is being recorded/)).toBeNull();
  });

  it('says so while only a tab is being recorded, and reports what was shared', async () => {
    recordingBrowser(jest.fn(async () => stream('browser')));
    mockUseAuth.mockReturnValue({ user: { email: 'ana@example.com' }, authenticatedFetch } as any);
    render(<FeedbackButton />);
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    });
    expect(screen.getByText(/Only this tab is being recorded/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Stop recording/ }));
    await screen.findByLabelText('What were you trying to do?');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(mockSend).toHaveBeenCalled());
    expect(mockSend.mock.calls[0][0].request).toMatchObject({ captured: 'browser' });
  });

  it('stops when sharing is ended from the browser itself', async () => {
    const media = stream();
    const recorders = recordingBrowser(jest.fn(async () => media));
    render(<FeedbackButton />);
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    });
    const [event, ended] = media.track.addEventListener.mock.calls[0];
    expect(event).toBe('ended');
    act(() => ended());
    expect(recorders[0].state).toBe('inactive');
    expect(await screen.findByLabelText('What were you trying to do?')).toBeInTheDocument();
  });

  it('offers the upload instead when screen sharing is refused', async () => {
    recordingBrowser(jest.fn(async () => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    }));
    render(<FeedbackButton />);
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    });
    expect(screen.getByText(/We could not record your screen from this page/)).toBeInTheDocument();
    expect(screen.getByLabelText('Upload recording', { selector: 'input' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start recording' })).toBeNull();
    // A computer's own recorder, not a phone's.
    expect(screen.getByText(/Shift \+ Command \+ 5/)).toBeInTheDocument();
    expect(screen.queryByText(/Control Centre/)).toBeNull();
  });

  it('goes straight to the upload when the site framing us does not allow screen capture', () => {
    const getDisplayMedia = jest.fn();
    recordingBrowser(getDisplayMedia);
    Object.defineProperty(document, 'featurePolicy', { configurable: true, value: { allowsFeature: (feature: string) => feature !== 'display-capture' } });
    try {
      render(<FeedbackButton />);
      open();
      expect(screen.queryByRole('button', { name: 'Start recording' })).toBeNull();
      expect(screen.getByLabelText('Upload recording', { selector: 'input' })).toBeInTheDocument();
      expect(screen.getByText(/Shift \+ Command \+ 5/)).toBeInTheDocument();
      expect(getDisplayMedia).not.toHaveBeenCalled();
    } finally {
      delete (document as unknown as { featurePolicy?: unknown }).featurePolicy;
    }
  });

  it('records through a window of our own when a partner site frames us without allowing capture', async () => {
    const getDisplayMedia = jest.fn();
    recordingBrowser(getDisplayMedia);
    Object.defineProperty(document, 'featurePolicy', { configurable: true, value: { allowsFeature: () => false } });
    const realParent = window.parent;
    Object.defineProperty(window, 'parent', { configurable: true, value: {} });
    const popup = { closed: false, close: jest.fn(), postMessage: jest.fn() };
    const openWindow = jest.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const say = (data: unknown, source: unknown = popup, origin = window.location.origin) =>
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data, origin, source: source as MessageEventSource }));
      });
    try {
      mockUseAuth.mockReturnValue({ user: { email: 'ana@example.com' }, authenticatedFetch } as any);
      render(<FeedbackButton />);
      open();
      fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
      expect(openWindow).toHaveBeenCalledWith('/report-recorder/', 'problem-recorder', expect.any(String));
      expect(getDisplayMedia).not.toHaveBeenCalled();
      expect(screen.getByText(/small window that opened/)).toBeInTheDocument();

      // Nobody but the window we opened, on our own origin, is believed.
      say({ type: 'problem-recorder', event: 'started', surface: 'monitor' }, {});
      say({ type: 'problem-recorder', event: 'started', surface: 'monitor' }, popup, 'https://shop.example');
      expect(screen.queryByRole('button', { name: /Stop recording/ })).toBeNull();

      say({ type: 'problem-recorder', event: 'started', surface: 'monitor' });
      fireEvent.click(screen.getByRole('button', { name: /Stop recording/ }));
      expect(popup.postMessage).toHaveBeenCalledWith({ type: 'problem-recorder', event: 'stop' }, window.location.origin);

      say({ type: 'problem-recorder', event: 'finished', blob: new Blob(['video'], { type: 'video/webm' }), hitLimit: false, surface: 'monitor' });
      await screen.findByLabelText('What were you trying to do?');
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(mockSend).toHaveBeenCalled());
      expect(mockSend.mock.calls[0][0].request).toMatchObject({ source: 'recorder', captured: 'monitor' });
    } finally {
      openWindow.mockRestore();
      Object.defineProperty(window, 'parent', { configurable: true, value: realParent });
      delete (document as unknown as { featurePolicy?: unknown }).featurePolicy;
    }
  });

  it('falls back to the upload when the browser blocks that window', () => {
    recordingBrowser(jest.fn());
    Object.defineProperty(document, 'featurePolicy', { configurable: true, value: { allowsFeature: () => false } });
    const realParent = window.parent;
    Object.defineProperty(window, 'parent', { configurable: true, value: {} });
    const openWindow = jest.spyOn(window, 'open').mockReturnValue(null);
    try {
      render(<FeedbackButton />);
      open();
      fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
      expect(screen.queryByRole('button', { name: 'Start recording' })).toBeNull();
      expect(screen.getByLabelText('Upload recording', { selector: 'input' })).toBeInTheDocument();
    } finally {
      openWindow.mockRestore();
      Object.defineProperty(window, 'parent', { configurable: true, value: realParent });
      delete (document as unknown as { featurePolicy?: unknown }).featurePolicy;
    }
  });
});
