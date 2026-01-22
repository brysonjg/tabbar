function getFileIconFileName(fname, fmime) {
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
	switch (ext) {
		case 'sh':
		case 'bash': return 'application-x-executable.svg';
		case 'yml':
		case 'yaml': return 'text-yaml.svg';
		case 'lock': return 'lock.svg';
		case 'exe': return 'application-x-ms-dos-executable.svg';
		case 'jsx': return 'applacation-react-java.svg';
		case '':
			// no extension: fall back to mime-based filename if available
			return `${(fmime || 'none').replace('/', '-')}.svg`;
		default:
			// unknown extension: use mime fallback if provided, otherwise unknown.svg
			return fmime ? `${fmime.replace('/', '-')}.svg` : 'unknown.svg';
	}
}
