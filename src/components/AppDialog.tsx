import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, MessageSquareText, X } from 'lucide-react';

type DialogKind = 'alert' | 'confirm' | 'prompt';
type DialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  tone?: 'default' | 'danger';
};
type DialogRequest = DialogOptions & { kind: DialogKind; resolve: (value: boolean | string | null) => void };

let activeListener: ((request: DialogRequest) => void) | null = null;
const waiting: DialogRequest[] = [];

const requestDialog = (kind: DialogKind, options: DialogOptions) => new Promise<boolean | string | null>((resolve) => {
  const request = { ...options, kind, resolve };
  if (activeListener) activeListener(request);
  else waiting.push(request);
});

export const alertDialog = (options: DialogOptions | string) => requestDialog('alert', typeof options === 'string' ? { message: options } : options) as Promise<boolean>;
export const confirmDialog = (options: DialogOptions | string) => requestDialog('confirm', typeof options === 'string' ? { message: options } : options) as Promise<boolean>;
export const promptDialog = (options: DialogOptions) => requestDialog('prompt', options) as Promise<string | null>;

export default function AppDialogHost() {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    activeListener = (next) => setRequest(current => { if (current) { waiting.push(next); return current; } return next; });
    if (waiting.length) setRequest(waiting.shift() || null);
    return () => { activeListener = null; };
  }, []);

  useEffect(() => {
    setValue(request?.defaultValue || '');
    if (request?.kind === 'prompt') window.setTimeout(() => (request.multiline ? textareaRef.current : inputRef.current)?.focus(), 30);
  }, [request]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && request) finish(request.kind === 'prompt' ? null : false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });

  const finish = (result: boolean | string | null) => {
    if (!request) return;
    request.resolve(result);
    setRequest(waiting.shift() || null);
  };

  if (!request) return null;
  const title = request.title || (request.kind === 'alert' ? '안내' : request.kind === 'confirm' ? '확인' : '내용 입력');
  const Icon = request.kind === 'prompt' ? MessageSquareText : request.tone === 'danger' ? AlertCircle : CheckCircle2;
  return <div className="app-dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && finish(request.kind === 'prompt' ? null : false)}>
    <section className={`app-dialog ${request.tone === 'danger' ? 'danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
      <header><span><Icon size={21}/></span><div><h2 id="app-dialog-title">{title}</h2><p>{request.message}</p></div><button type="button" aria-label="닫기" onClick={() => finish(request.kind === 'prompt' ? null : false)}><X size={18}/></button></header>
      {request.kind === 'prompt' && (request.multiline
        ? <textarea ref={textareaRef} value={value} onChange={event => setValue(event.target.value)} placeholder={request.placeholder} rows={5}/>
        : <input ref={inputRef} value={value} onChange={event => setValue(event.target.value)} placeholder={request.placeholder}/>) }
      <footer>{request.kind !== 'alert' && <button type="button" className="dialog-cancel" onClick={() => finish(request.kind === 'prompt' ? null : false)}>{request.cancelLabel || '취소'}</button>}<button type="button" className="dialog-confirm" onClick={() => finish(request.kind === 'prompt' ? value : true)}>{request.confirmLabel || '확인'}</button></footer>
    </section>
  </div>;
}
