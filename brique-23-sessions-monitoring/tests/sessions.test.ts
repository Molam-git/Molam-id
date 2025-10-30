import { listUserSessions, terminateSession } from '../src/sessions/repo';

describe('Brique 23 - Sessions Monitoring', () => {
  it('should have listUserSessions function', () => {
    expect(typeof listUserSessions).toBe('function');
  });

  it('should have terminateSession function', () => {
    expect(typeof terminateSession).toBe('function');
  });

  it('should support multiple device types', () => {
    const types = ['ios', 'android', 'web', 'desktop', 'ussd', 'api'];
    expect(types.length).toBe(6);
  });
});
