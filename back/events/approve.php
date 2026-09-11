<?php
session_start();
require_once '../conexao.php';

if (!isset($_SESSION['usuario_perfil']) || $_SESSION['usuario_perfil'] !== 'Administrador') {
    die("Apenas administradores podem realizar esta operacao.");
}

$id_evento = $_GET['id'] ?? '';
$acao = $_GET['acao'] ?? '';

if ($id_evento && in_array($acao, ['aprovar', 'cancelar'])) {
    $novo_status = ($acao === 'aprovar') ? 'PUBLICADO' : 'CANCELADO';

    $stmt = $pdo->prepare("UPDATE evento SET status = :status WHERE id_evento = :id");
    $stmt->execute([':status' => $novo_status, ':id' => $id_evento]);
}

header("Location: ../../front/pages(html)/admin/gerenciar_eventos.php");
exit;
?>