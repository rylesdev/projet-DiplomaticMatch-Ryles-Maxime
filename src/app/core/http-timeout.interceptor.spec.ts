import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { REQUEST_TIMEOUT_MS, timeoutInterceptor } from './http-timeout.interceptor';
import { apiErrorMessage, TIMEOUT_MESSAGE } from './services/diplomatic-api.service';
import { groupErrorMessage } from './services/groups-api.service';

describe('timeoutInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([timeoutInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => vi.useRealTimers());

  it('fails a request that gets no answer, with a clear French message', () => {
    const error = vi.fn();
    http.get('/api/matrix').subscribe({ error });
    const request = controller.expectOne('/api/matrix');
    vi.advanceTimersByTime(REQUEST_TIMEOUT_MS - 1);
    expect(error).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(request.cancelled).toBe(true);
    expect(apiErrorMessage(error.mock.calls[0][0])).toBe(TIMEOUT_MESSAGE);
    expect(groupErrorMessage(error.mock.calls[0][0])).toBe(TIMEOUT_MESSAGE);
  });

  it('lets a request answered in time go through unchanged', () => {
    const next = vi.fn();
    http.get('/api/health').subscribe(next);
    vi.advanceTimersByTime(1000);
    controller.expectOne('/api/health').flush({ status: 'ok' });
    expect(next).toHaveBeenCalledWith({ status: 'ok' });
    controller.verify();
  });
});
