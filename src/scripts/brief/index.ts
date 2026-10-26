// Бриф: открытие/закрытие оверлея, валидация формы, файлы, отправка и экран успеха.
import { ERRORS, FILES } from '../../data/brief';
import { PHONE_PREFIX, checkFile, formatPhone, formatSize, isName, isPhone, parseContact, phoneDigits } from './validate';
import { submitBrief } from './submit';

const root = document.documentElement;
const brief = document.querySelector<HTMLDialogElement>('[data-brief]');
const form = brief?.querySelector<HTMLFormElement>('[data-brief-form]');

if (brief && form) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pageParts = () => [...document.querySelectorAll<HTMLElement>('.page > main, .page > footer')];
  let opener: HTMLElement | null = null;
  let pushedHash = false;
  let submitted = false; // ошибки показываем только после первой попытки отправки
  let sent = false; // после успешной отправки следующее открытие — с чистой формы
  let sending = false;

  // ---------- Открытие / закрытие ----------

  function open(trigger?: HTMLElement | null) {
    if (brief!.open) return;
    if (sent) resetForm();
    opener = trigger ?? (document.activeElement as HTMLElement | null);
    // страница под брифом уменьшается к центру видимой области
    for (const el of pageParts()) el.style.transformOrigin = `50% ${scrollY + innerHeight / 2 - el.offsetTop}px`;
    brief!.scrollTop = 0;
    // не showModal(): модальность делает инертной всю длинную страницу и пересчитывает её стили
    // в первом кадре анимации. aria-modal, ловушка фокуса и Esc — свои (ниже)
    brief!.show();
    root.classList.add('is-brief-open');
    // фокус — в следующем кадре, когда стили уже посчитаны: иначе первый кадр анимации тормозит
    requestAnimationFrame(() => brief!.querySelector<HTMLElement>('.brief__close')?.focus({ preventScroll: true }));
  }

  function close() {
    if (!brief!.open) return;
    brief!.close();
  }

  // × / «На главную» / Esc: если бриф открыли нашим кликом — шаг назад по истории, иначе убираем #brief
  function requestClose() {
    if (pushedHash && history.state?.brief) history.back();
    else {
      close();
      if (location.hash === '#brief') history.replaceState(null, '', location.pathname + location.search);
    }
  }

  brief.addEventListener('close', () => {
    root.classList.remove('is-brief-open');
    pushedHash = false;
    // фокус на кнопку, которой открыли, браузер возвращает сам; вручную — только если её нет в фокусе,
    // и в следующем кадре, чтобы не пересчитывать страницу синхронно в момент закрытия
    requestAnimationFrame(() => {
      if (opener && document.activeElement !== opener) opener.focus({ preventScroll: true });
    });
  });

  // Esc закрывает; Tab не выпускает фокус из брифа
  const focusable = () =>
    [...brief.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([tabindex="-1"]), textarea, [tabindex="0"]')].filter(
      (el) => el.getClientRects().length > 0 && !el.closest('[hidden]'),
    );
  brief.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const list = focusable();
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (event.shiftKey && (document.activeElement === first || !brief.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  addEventListener('popstate', () => {
    if (location.hash === '#brief') open();
    else close();
  });

  // CTA: ссылка остаётся рабочей без JS (mailto), с JS — открывает бриф
  document.addEventListener('click', (event) => {
    const trigger = (event.target as Element).closest<HTMLElement>('[data-brief-open]');
    if (trigger) {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      if (brief.open) return;
      history.pushState({ brief: true }, '', '#brief');
      pushedHash = true;
      // мобильное меню закрываем, чтобы бриф не открылся под ним
      document.querySelector<HTMLDialogElement>('#mobile-menu[open]')?.close();
      open(trigger);
      return;
    }
    if ((event.target as Element).closest('[data-brief-close]')) requestClose();
  });

  // Ссылки на разделы главной из футера брифа: закрываем бриф без шага назад по истории,
  // дальше обычный переход по якорю (плавный — через smooth-scroll, после закрытия)
  brief.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link || link.getAttribute('href') === '#') return;
    close();
    if (location.hash === '#brief') history.replaceState(null, '', location.pathname + location.search);
  });

  if (location.hash === '#brief') open();

  // ---------- Поля ----------

  type FieldName = 'name' | 'company' | 'contact' | 'phone';
  const fields: FieldName[] = ['name', 'company', 'contact', 'phone'];
  const control = (name: string) => form.elements.namedItem(name) as HTMLInputElement;

  function fieldError(name: FieldName): string {
    const value = control(name).value.trim();
    if (!value) return ERRORS[name].empty;
    if (name === 'name' || name === 'company') return isName(value) ? '' : ERRORS[name].invalid;
    if (name === 'contact') return parseContact(value) ? '' : ERRORS.contact.invalid;
    if (!phoneDigits(value)) return ERRORS.phone.empty; // только «+7 »
    return isPhone(value) ? '' : ERRORS.phone.invalid;
  }

  function showFieldError(name: FieldName, message: string) {
    const input = control(name);
    const error = document.getElementById(`brief-${name}-error`)!;
    error.textContent = message;
    error.hidden = !message;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', error.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  type GroupName = 'services' | 'budget';
  const groupError = (name: GroupName) =>
    form.querySelector(`input[name="${name}"]:checked`) ? '' : ERRORS[name].empty;

  function showGroupError(name: GroupName, message: string) {
    const error = document.getElementById(`brief-${name}-error`)!;
    error.textContent = message;
    error.hidden = !message;
  }

  // после первой отправки — перепроверка на лету
  for (const name of fields) {
    const input = control(name);
    const recheck = () => submitted && showFieldError(name, fieldError(name));
    input.addEventListener('input', recheck);
    input.addEventListener('blur', recheck);
  }
  for (const name of ['services', 'budget'] as GroupName[]) {
    form.querySelector(`[data-group="${name}"]`)!.addEventListener('change', () => {
      if (submitted) showGroupError(name, groupError(name));
    });
  }

  // Маска телефона: +7 (999) 123-45-67
  {
    const phone = control('phone');
    let prevDigits = '';
    // позиция в отформатированной строке сразу после n-й цифры номера
    const caretAfter = (text: string, n: number) => {
      if (n === 0) return PHONE_PREFIX.length + (text.length > PHONE_PREFIX.length ? 1 : 0);
      let seen = 0;
      for (let i = PHONE_PREFIX.length; i < text.length; i++) if (/\d/.test(text[i]) && ++seen === n) return i + 1;
      return text.length;
    };
    phone.addEventListener('focus', () => {
      if (!phone.value) phone.value = PHONE_PREFIX;
      prevDigits = phoneDigits(phone.value);
    });
    phone.addEventListener('blur', () => {
      if (!phoneDigits(phone.value)) phone.value = '';
    });
    // Вставка из буфера: целый номер заменяет поле, кусок цифр — встаёт на место курсора.
    // Саму вставку не запрещаем (браузер вставит текст как есть) — разбираем её в input ниже
    let paste: { text: string; head: string; tail: string } | null = null;
    phone.addEventListener('paste', (event) => {
      const caret = phone.selectionStart ?? phone.value.length;
      const end = phone.selectionEnd ?? caret;
      paste = {
        text: event.clipboardData?.getData('text') ?? '',
        head: phone.value.slice(0, caret).replace(/\D/g, '').slice(1),
        tail: phone.value.slice(end).replace(/\D/g, ''),
      };
    });
    phone.addEventListener('input', (event) => {
      const inputType = (event as InputEvent).inputType ?? '';
      if (paste) {
        const { text, head, tail } = paste;
        paste = null;
        const pasted = text.replace(/\D/g, '');
        const digits = pasted.length >= 10 ? phoneDigits(text.trim().startsWith('+') || pasted.length === 11 ? text : `+7${text}`) : (head + pasted + tail).slice(0, 10);
        phone.value = formatPhone(digits);
        const at = pasted.length >= 10 ? phone.value.length : caretAfter(phone.value, Math.min(head.length + pasted.length, digits.length));
        phone.setSelectionRange(at, at);
        prevDigits = digits;
        return;
      }
      const raw = phone.value;
      const caret = phone.selectionStart ?? raw.length;
      let digits = phoneDigits(raw);
      // вставили или подставили целый номер (автозаполнение, «+7 999…», «8 999…») — разбираем его отдельно
      const data = (event as InputEvent).data ?? '';
      if (data.replace(/\D/g, '').length >= 10) {
        digits = phoneDigits(data.trim().startsWith('+') || data.replace(/\D/g, '').length === 11 ? data : `+7${data}`);
        phone.value = formatPhone(digits);
        prevDigits = digits;
        return;
      }
      // сколько цифр номера стоит до курсора (без кода страны в «+7»)
      const before = raw.slice(0, caret).replace(/\D/g, '').length - (raw.startsWith('+7') ? 1 : 0);
      let pos = Math.max(0, before);
      // привычка набирать 8/7 первой цифрой — это код страны, не часть номера
      if (!prevDigits && inputType.startsWith('insert') && /^[78]$/.test(digits)) digits = '';
      // Backspace по скобке, пробелу или дефису — стираем цифру перед ними
      if (inputType === 'deleteContentBackward' && digits === prevDigits && pos > 0) {
        digits = digits.slice(0, pos - 1) + digits.slice(pos);
        pos -= 1;
      }
      const text = formatPhone(digits);
      phone.value = text;
      const at = caretAfter(text, Math.min(pos, digits.length));
      phone.setSelectionRange(at, at);
      prevDigits = digits;
    });
  }

  // textarea растёт по высоте и там, где нет field-sizing: content
  if (!CSS.supports('field-sizing', 'content')) {
    for (const area of form.querySelectorAll<HTMLTextAreaElement>('[data-autosize]')) {
      area.addEventListener('input', () => {
        area.style.height = 'auto';
        area.style.height = `${area.scrollHeight + 1.5}px`;
      });
    }
  }

  // ---------- Файлы ----------

  const upload = form.querySelector<HTMLElement>('[data-upload]')!;
  const fileInput = upload.querySelector<HTMLInputElement>('[data-upload-input]')!;
  const list = upload.querySelector<HTMLUListElement>('[data-upload-list]')!;
  const addButton = upload.querySelector<HTMLButtonElement>('[data-upload-add]')!;
  const action = upload.querySelector<HTMLElement>('[data-upload-action]')!;
  const template = upload.querySelector<HTMLTemplateElement>('[data-upload-item]')!;
  let files: { file: File; problem: ReturnType<typeof checkFile> }[] = [];

  function renderFiles() {
    list.replaceChildren(
      ...files.map(({ file, problem }, index) => {
        const item = template.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
        item.classList.toggle('is-error', !!problem);
        item.querySelector('[data-file-name]')!.textContent = file.name;
        item.querySelector('[data-file-meta]')!.textContent =
          problem === 'size' ? ERRORS.fileSize : problem === 'type' ? ERRORS.fileType : formatSize(file.size);
        const remove = item.querySelector<HTMLButtonElement>('[data-file-remove]')!;
        remove.setAttribute('aria-label', `Удалить ${file.name}`);
        remove.addEventListener('click', () => {
          files.splice(index, 1);
          renderFiles();
          addButton.focus();
        });
        return item;
      }),
    );
    list.hidden = files.length === 0;
    action.textContent = files.length ? 'Прикрепить ещё' : 'Прикрепить документ';
    addButton.hidden = files.length >= FILES.max;
  }

  function addFiles(selected: FileList | File[]) {
    for (const file of selected) {
      if (files.length >= FILES.max) break;
      files.push({ file, problem: checkFile(file) });
    }
    renderFiles();
  }

  addButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files) addFiles(fileInput.files);
    fileInput.value = '';
  });

  // drag & drop на область загрузки
  upload.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    upload.classList.add('is-dragover');
  });
  upload.addEventListener('dragleave', (event) => {
    if (!upload.contains(event.relatedTarget as Node)) upload.classList.remove('is-dragover');
  });
  upload.addEventListener('drop', (event) => {
    event.preventDefault();
    upload.classList.remove('is-dragover');
    if (event.dataTransfer?.files.length) addFiles(event.dataTransfer.files);
  });

  // ---------- Отправка ----------

  const submitButton = form.querySelector<HTMLButtonElement>('[data-brief-submit]')!;
  const submitLabel = submitButton.querySelector('.btn__text')!;
  const sendError = form.querySelector<HTMLElement>('[data-brief-send-error]')!;

  function validateAll(): HTMLElement | null {
    let first: HTMLElement | null = null;
    for (const name of fields) {
      const message = fieldError(name);
      showFieldError(name, message);
      if (message && !first) first = control(name);
    }
    for (const name of ['services', 'budget'] as GroupName[]) {
      const message = groupError(name);
      showGroupError(name, message);
      if (message && !first) first = form.querySelector<HTMLElement>(`input[name="${name}"]`);
    }
    return first;
  }

  function scrollToField(el: HTMLElement) {
    const target = el.closest<HTMLElement>('.field, fieldset') ?? el;
    const top = target.getBoundingClientRect().top - brief!.getBoundingClientRect().top + brief!.scrollTop - 24;
    brief!.scrollTo({ top, behavior: reduced.matches ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  }

  function buildData(): FormData {
    const data = new FormData();
    data.set('name', control('name').value.trim());
    data.set('company', control('company').value.trim());
    const contact = parseContact(control('contact').value)!;
    data.set('contact', contact.value);
    data.set('contact_type', contact.type);
    data.set('phone', `+7${phoneDigits(control('phone').value)}`);
    for (const input of form.querySelectorAll<HTMLInputElement>('input[name="services"]:checked')) data.append('services', input.value);
    data.set('task', (form.elements.namedItem('task') as HTMLTextAreaElement).value.trim());
    data.set('budget', form.querySelector<HTMLInputElement>('input[name="budget"]:checked')!.value);
    for (const { file, problem } of files) if (!problem) data.append('files', file, file.name);
    return data;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    submitted = true;
    sendError.textContent = '';
    const invalid = validateAll();
    if (invalid) {
      scrollToField(invalid);
      return;
    }
    sending = true;
    submitButton.disabled = true;
    submitLabel.textContent = 'Отправляем…';
    try {
      await submitBrief(buildData());
      sent = true;
      showSuccess();
    } catch {
      sendError.textContent = ERRORS.submit;
    } finally {
      sending = false;
      submitButton.disabled = false;
      submitLabel.textContent = 'Отправить заявку';
    }
  });

  // ---------- Экран успеха ----------

  const formView = brief.querySelector<HTMLElement>('[data-brief-view="form"]')!;
  const successView = brief.querySelector<HTMLElement>('[data-brief-view="success"]')!;

  function showSuccess() {
    const swap = () => {
      formView.hidden = true;
      formView.classList.remove('is-leaving');
      successView.hidden = false;
      brief!.scrollTop = 0;
      brief!.querySelector<HTMLElement>('[data-brief-success-title]')?.focus({ preventScroll: true });
    };
    if (reduced.matches) return swap();
    formView.classList.add('is-leaving');
    setTimeout(swap, 300);
  }

  function resetForm() {
    form!.reset();
    files = [];
    renderFiles();
    submitted = false;
    sent = false;
    sendError.textContent = '';
    for (const name of fields) showFieldError(name, '');
    showGroupError('services', '');
    showGroupError('budget', '');
    formView.hidden = false;
    successView.hidden = true;
  }
}
