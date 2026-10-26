// Отправка брифа: multipart/form-data на PUBLIC_BRIEF_ENDPOINT.
// Пока бэкенда нет (переменная не задана) — мок: успешный ответ через 800 мс.
const ENDPOINT = import.meta.env.PUBLIC_BRIEF_ENDPOINT as string | undefined;

export async function submitBrief(data: FormData): Promise<void> {
  if (!ENDPOINT) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return;
  }
  const response = await fetch(ENDPOINT, { method: 'POST', body: data });
  if (!response.ok) throw new Error(`Бриф не отправлен: ${response.status}`);
}
