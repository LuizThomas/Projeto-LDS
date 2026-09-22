<?php
session_start();
require_once '../conexao.php';

if (!isset($_SESSION['usuario_id'])) {
    header("Location: ../../frontend/pages/auth/login.html");
    exit;
}

$id_evento = $_GET['id_evento'] ?? $_POST['id_evento'] ?? '';
$id_usuario = $_SESSION['usuario_id'];

if (!$id_evento) {
    die("Evento nao especificado.");
}

$stmt = $pdo->prepare("SELECT data_inicio FROM evento WHERE id_evento = :id");
$stmt->execute([':id' => $id_evento]);
$evento = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$evento) {
    die("Evento nao encontrado.");
}

$agora = date('Y-m-d H:i:s');
if ($agora >= $evento['data_inicio']) {
    header("Location: ../../frontend/pages/attendee/my-subscriptions.php?erro=evento_iniciado");
    exit;
}

$sql = "UPDATE inscricao SET status = 'CANCELADA' WHERE id_evento = :id_evento AND id_usuario = :id_usuario";
$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':id_evento' => $id_evento,
    ':id_usuario' => $id_usuario
]);

header("Location: ../../frontend/pages/attendee/my-subscriptions.php?cancelado=1");
exit;
?>