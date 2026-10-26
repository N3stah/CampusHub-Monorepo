import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createApplicationFormData,
  downloadBlob,
  getDownloadFilename,
  resolveSameOriginFileUrl,
  validateCvFile,
} from '@/lib/application-files';

describe('application files', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('builds multipart application data with an optional CV', () => {
    const cv = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
    const withCv = createApplicationFormData('  I am interested.  ', cv);
    const withoutCv = createApplicationFormData('I am interested.', null);

    expect(withCv.get('cover_note')).toBe('I am interested.');
    expect(withCv.get('cv_file')).toBe(cv);
    expect(withoutCv.get('cv_file')).toBeNull();
  });

  it('validates CV file extensions and the 10 MB limit', () => {
    expect(validateCvFile(new File(['cv'], 'resume.DOCX'))).toBeNull();
    expect(validateCvFile(new File(['image'], 'photo.png'))).toContain('PDF, DOC, or DOCX');
    expect(validateCvFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf'))).toContain('10 MB');
  });

  it('accepts only same-origin file URLs', () => {
    expect(resolveSameOriginFileUrl('/media/cv.pdf', 'https://api.example.test/api', 'https://app.example.test'))
      .toBe('https://api.example.test/media/cv.pdf');
    expect(() => resolveSameOriginFileUrl('https://evil.example/cv.pdf', 'https://api.example.test/api', 'https://app.example.test'))
      .toThrow('unsafe file URL');
  });

  it('downloads a blob using the response filename and revokes the temporary URL', () => {
    vi.useFakeTimers();
    class TestURL extends URL {
      static createObjectURL = vi.fn().mockReturnValue('blob:cv');
      static revokeObjectURL = vi.fn();
    }
    vi.stubGlobal('URL', TestURL);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const blob = new Blob(['cv data']);

    downloadBlob(blob, getDownloadFilename('attachment; filename="student-cv.pdf"', 'application-cv'));

    expect(TestURL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(TestURL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(TestURL.revokeObjectURL).toHaveBeenCalledWith('blob:cv');
  });
});
