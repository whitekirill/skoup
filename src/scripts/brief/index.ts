// Бриф: открытие/закрытие оверлея, валидация формы, файлы, отправка и экран успеха.
import { ERRORS, FILES } from '../../data/brief';
import { LEGAL_EDITION } from '../../data/site';
import { checkFile, formatSize, isName, isPhone, normalizePhone, parseContact } from './validate';
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
      open(trigger);
      return;
    }
    if ((event.target as Element).closest('[data-brief-close]')) requestClose();
  });

  // Ссылки на разделы главной из футера брифа: закрываем бриф без шага назад по истории,
  // дальше обычный переход по якорю (плавный — через anchor-scroll, после закрытия)
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

  type GroupName = 'services' | 'contact_method';
  const groupError = (name: GroupName) =>
    form.querySelector(`input[name="${name}"]:checked`) ? '' : ERRORS[name === 'contact_method' ? 'contactMethod' : name].empty;

  function showGroupError(name: GroupName, message: string) {
    const error = document.getElementById(`brief-${name}-error`)!;
    error.textContent = message;
    error.hidden = !message;
  }

  // Согласие на обработку данных — обязательная галочка (рассылка — по желанию, без проверки)
  const consent = control('consent');
  const consentError = () => (consent.checked ? '' : ERRORS.consent);

  function showConsentError(message: string) {
    const error = document.getElementById('brief-consent-error')!;
    error.textContent = message;
    error.hidden = !message;
    if (message) {
      consent.setAttribute('aria-invalid', 'true');
      consent.setAttribute('aria-describedby', error.id);
    } else {
      consent.removeAttribute('aria-invalid');
      consent.removeAttribute('aria-describedby');
    }
  }

  consent.addEventListener('change', () => submitted && showConsentError(consentError()));

  // после первой отправки — перепроверка на лету
  for (const name of fields) {
    const input = control(name);
    const recheck = () => submitted && showFieldError(name, fieldError(name));
    input.addEventListener('input', recheck);
    input.addEventListener('blur', recheck);
  }
  for (const name of ['services', 'contact_method'] as GroupName[]) {
    form.querySelector(`[data-group="${name}"]`)!.addEventListener('change', () => {
      if (submitted) showGroupError(name, groupError(name));
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
    for (const name of ['services', 'contact_method'] as GroupName[]) {
      const message = groupError(name);
      showGroupError(name, message);
      if (message && !first) first = form!.querySelector<HTMLElement>(`input[name="${name}"]`);
    }
    const message = consentError();
    showConsentError(message);
    if (message && !first) first = consent;
    return first;
  }

  function scrollToField(el: HTMLElement) {
    const target = el.closest<HTMLElement>('.field, fieldset, .checkbox') ?? el;
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
    data.set('phone', normalizePhone(control('phone').value));
    for (const input of form!.querySelectorAll<HTMLInputElement>('input[name="services"]:checked')) data.append('services', input.value);
    data.set('task', (form!.elements.namedItem('task') as HTMLTextAreaElement).value.trim());
    data.set('contact_method', form!.querySelector<HTMLInputElement>('input[name="contact_method"]:checked')!.value);
    for (const { file, problem } of files) if (!problem) data.append('files', file, file.name);
    // факт согласий и редакция их текстов — оператор обязан доказать согласие (ч. 3 ст. 9 152-ФЗ, ч. 1 ст. 18 38-ФЗ);
    // время получения записывает сервер
    data.set('consent', 'yes');
    data.set('consent_version', LEGAL_EDITION);
    data.set('marketing', control('marketing').checked ? 'yes' : 'no');
    if (control('marketing').checked) data.set('marketing_version', LEGAL_EDITION);
    data.set('website', control('website').value); // ловушка для ботов — у людей пустая
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
    showGroupError('contact_method', '');
    showConsentError('');
    formView.hidden = false;
    successView.hidden = true;
  }
}
