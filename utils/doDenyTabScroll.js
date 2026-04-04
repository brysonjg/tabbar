function doDenyTabScroll() {
    let hasTouchScreen = (
        (navigator.maxTouchPoints > 0) ||
        (window.matchMedia("(pointer: coarse)").matches) ||
        ('ontouchstart' in window) ||
        (navigator.msMaxTouchPoints > 0)
    );
    let isAppleDevice = (() =>{
        const platform = navigator.userAgentData?.platform || navigator.platform || '';
        const ua = navigator.userAgent;

        const isApplePlatform = /Mac|iPhone|iPad|iPod/.test(platform);
        const isMacUA = /Macintosh/.test(ua);

        return isApplePlatform || isMacUA;
    })();

    return isAppleDevice || hasTouchScreen;
}
