
export function request(url: string, timeout: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const win = window, doc = document, el = 'script';

    let timer: number | undefined;

    const onLoad = () => {
      win.clearTimeout(timer);
      resolve();
    };

    const first = doc.getElementsByTagName(el)[0];
    const script = doc.createElement(el);

    script.src = url;
    script.async = true;
    script.onload = onLoad;
    script.onerror = onLoad; // TODO reject?
  
    first?.parentNode?.insertBefore(script, first);
    if (timeout) {
      timer = win.setTimeout(onLoad, timeout);
    }
  });
}
