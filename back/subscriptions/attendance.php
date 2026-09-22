<?php
session_start();
require_once '../conexao.php';

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['usuario_perfil'], ['Professor', 'Administrador'])) {
    die("Acesso negado.");
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id_evento = $_POST['id_evento'] ?? '';
    $presentes = $_POST['presentes'] ?? []; 

    if (!$id_evento) {
        die("Evento nao informado.");
    }

    $stmtReset = $pdo->prepare("UPDATE inscricao SET status = 'CONFIRMADA' WHERE id_evento = :id_evento AND status != 'CANCELADA'");
    $stmtReset->execute([':id_evento' => $id_evento]);

    if (!empty($presentes)) {
        $in  = str_repeat('?,', count($presentes) - 1) . '?';
        $sql = "UPDATE inscricao SET status = 'PRESENTE' WHERE id_evento = ? AND id_usuario IN ($in)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_merge([$id_evento], $presentes));
    }

    header("Location: ../../frontend/pages/events/attendance.php?id=" . $id_evento . "&salvo=1");
    exit;
}
?>