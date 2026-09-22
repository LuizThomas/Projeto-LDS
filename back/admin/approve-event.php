<?php
session_start();
require_once '../conexao.php';

if (($_SESSION['usuario_perfil'] ?? '') !== 'Administrador') {
    die("Acesso negado.");
}

$id_evento = $_POST['id_evento'] ?? null;
$acao = $_POST['acao'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $id_evento && $acao) {
    $statusMap = [
        'aprovar'  => 'PUBLICADO',
        'reprovar' => 'CANCELADO'
    ];

    if (isset($statusMap[$acao])) {
        $sql = "UPDATE evento SET status = :status WHERE id_evento = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':status' => $statusMap[$acao],
            ':id'     => $id_evento
        ]);
    }
}

header("Location: ../../frontend/pages/admin/events-pending.php?sucesso=1");
exit;
?>