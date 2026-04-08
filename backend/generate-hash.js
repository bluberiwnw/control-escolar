const bcrypt = require('bcryptjs');

const passwordAdmin = 'admin123';
const passwordAlumno = 'alumno123';

const salt = bcrypt.genSaltSync(10);
const hashAdmin = bcrypt.hashSync(passwordAdmin, salt);
const hashAlumno = bcrypt.hashSync(passwordAlumno, salt);

console.log('Hash para admin123:', hashAdmin);
console.log('Hash para alumno123:', hashAlumno);