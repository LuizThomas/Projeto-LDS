<?php
session_start();
require_once '../conexao.php';

if (!isset($_SESSION['usuario_id']) || $_SESSION['usuario_perfil'] !== 'Administrador') {
    die("Acesso negado.");
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id_usuario = $_POST['id_usuario'] ?? '';
    $acao = $_POST['acao'] ?? ''; 

    if ($id_usuario && $acao === 'aprovar') {
        $stmt = $pdo->prepare("UPDATE usuario SET aprovado = 1 WHERE id_usuario = :id AND perfil = 'Professor'");
        $stmt->execute([':id' => $id_usuario]);
    } elseif ($id_usuario && $acao === 'reprovar') {
        $stmt = $pdo->prepare("DELETE FROM usuario WHERE id_usuario = :id AND perfil = 'Professor' AND aprovado = 0");
        $stmt->execute([':id' => $id_usuario]);
    }

    header("Location: ../../frontend/pages/admin/teachers.php?sucesso=1");
    exit;
}
?>