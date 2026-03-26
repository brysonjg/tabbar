function hasBytes(view, count) {
    return view instanceof DataView && view.byteLength >= count;
}

function hasExecutableExtension(ext) {
    switch (ext) {
        case "app":
        case "appimage":
        case "apk":
        case "bat":
        case "bin":
        case "cmd":
        case "com":
        case "csh":
        case "deb":
        case "desktop":
        case "dll":
        case "dmg":
        case "exe":
        case "gadget":
        case "ipa":
        case "jar":
        case "ksh":
        case "msi":
        case "out":
        case "pkg":
        case "ps1":
        case "run":
        case "scr":
        case "sh":
        case "bash":
        case "tcsh":
        case "vbs":
        case "workflow":
        case "wsf":
            return true;
        default:
            return false;
    }
}

function isExecutable(name, view, ext = "") {
    if (hasExecutableExtension(ext)) return true;

    if (!hasBytes(view, 2)) return false;

    if (!hasBytes(view, 4)) return false;

    // ELF binary
    const isElf =
        view.getUint8(0) === 0x7F &&
        view.getUint8(1) === 0x45 &&
        view.getUint8(2) === 0x4C &&
        view.getUint8(3) === 0x46;

    // PE/COFF executable (MZ)
    const isPE =
        view.getUint8(0) === 0x4D &&
        view.getUint8(1) === 0x5A;

    // Mach-O magic numbers
    const magic = view.getUint32(0, false);
    const magicLE = view.getUint32(0, true);

    const isMachO =
        magic === 0xCAFEBABE ||
        magic === 0xBEBAFECA ||
        magic === 0xCAFEBABF ||
        magic === 0xBFBAFECA ||
        magic === 0xFEEDFACE ||
        magic === 0xCEFAEDFE ||
        magic === 0xFEEDFACF ||
        magic === 0xCFFAEDFE ||
        magicLE === 0xCAFEBABE ||
        magicLE === 0xBEBAFECA ||
        magicLE === 0xCAFEBABF ||
        magicLE === 0xBFBAFECA ||
        magicLE === 0xFEEDFACE ||
        magicLE === 0xCEFAEDFE ||
        magicLE === 0xFEEDFACF ||
        magicLE === 0xCFFAEDFE;

    return isElf || isPE || isMachO;
}

function getFileIconFileName(fname, fmime, fview) {
    const name = (fname || '').toLowerCase().trim();
    // fast exact filename checks
    switch (name) {
        case '.gitignore':
        case 'gitignore':
            return 'text-x-gitignore.svg';
        case 'readme':
        case 'readme.md':
        case 'readme.txt':
            return 'text-x-readme.svg';
        case 'license':
        case 'license.md':
            return 'text-x-copying.svg';
        case 'package.json':
        case 'package-lock.json':
        case '.npmrc':
        case '.npmignore':
        case 'npm-debug.log':
            return 'application-package-object.svg';
    }
    // handle just the basename
    const base = name.split('/').pop();
    const dotIndex = base.lastIndexOf('.');
    const ext = (dotIndex > 0) ? base.slice(dotIndex + 1) : '';

    if (isExecutable(base, fview, ext)) {
        if (ext === "exe" || ext === "com") {
            return "application-x-ms-dos-executable.svg";
        }

        if (ext === "ps1") {
            return "application-x-powershell.svg";
        }

        return "application-x-executable.svg";
    }

    switch (ext) {
        case 'yml':
        case 'yaml': return 'text-yaml.svg';
        case 'lock': return 'lock.svg';
        case 'jsx': return 'applacation-react-java.svg';
        case 'js': return 'application-x-javascript.svg';
        case 'md': return 'text-x-markdown.svg';
        case 'c': return 'text-x-csrc.svg';
        case '':
            return `${(fmime || 'none').replace('/', '-')}.svg`;
        default:
            // unknown extension: use mime fallback if provided, otherwise unknown.svg
            return fmime ? `${fmime.replace('/', '-')}.svg` : 'unknown.svg';
    }
}
