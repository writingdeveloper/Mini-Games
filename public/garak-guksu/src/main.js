const $ = (id) => document.getElementById(id);

function start() {
  $('start').classList.add('off');
  $('result').classList.add('off');
}
$('startbtn').addEventListener('click', start);
$('replaybtn').addEventListener('click', start);
