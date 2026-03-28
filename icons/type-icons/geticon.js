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
        case 'license.txt':
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
        case 'ps1': return 'application-x-powershell.svg';
        case '3dmf': return '3d-3dmf.svg';
        case '3ds': return '3d-3ds.svg';
        case 'abc': return '3d-abc.svg';
        case 'c4d': return '3d-c4d.svg';
        case 'dae': return '3d-dae.svg';
        case 'duf': return '3d-duf.svg';
        case 'dwg': return '3d-dwg.svg';
        case 'dxf': return '3d-dxf.svg';
        case 'fbx': return '3d-fbx.svg';
        case 'fpp': return '3d-fpp.svg';
        case 'glb':
        case 'gltf': return '3d-glb.svg';
        case 'igs':
        case 'iges': return '3d-igs.svg';
        case 'iprop': return '3d-iprop.svg';
        case 'max': return '3d-max.svg';
        case 'obj': return '3d-obj.svg';
        case 'ply': return '3d-ply.svg';
        case 'sat': return '3d-sat.svg';
        case 'stl': return '3d-stl.svg';
        case 'usd':
        case 'usdz':
        case 'usdc': return '3d-usd.svg';
        case 'vdb': return '3d-vdb.svg';
        case 'wrl':
        case 'vrml': return '3d-wrl.svg';
        case 'x3d': return '3d-x3d.svg';
        case 'f90':
        case 'f': case 'for':
        case 'ftn': case 'f95':
        case 'f03': case 'f08':
        case 'f18':
            return 'text-fortran.svg';
        case '':
            return `${(fmime || 'none').replace('/', '-')}.svg`;
        default:
            // unknown extension: use mime fallback if provided, otherwise unknown.svg
            return fmime ? `${fmime.replace('/', '-')}.svg` : 'unknown.svg';
    }
}
