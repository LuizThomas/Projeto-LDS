<?php
require_once '../conexao.php';

$categoria = $_GET['categoria'] ?? 'publicados';

$sql = "SELECT e.*, u.nome as organizador FROM evento e JOIN usuario u ON e.id_organizador = u.id_usuario WHERE ";

if ($categoria === 'ativos') {
    $sql .= "e.status = 'PUBLICADO' AND e.data_fim >= NOW()";
} elseif ($categoria === 'encerrados') {
    $sql .= "e.status = 'ENCERRADO' OR (e.status = 'PUBLICADO' AND e.data_fim < NOW())";
} elseif ($categoria === 'cancelados') {
    $sql .= "e.status = 'CANCELADO'";
} elseif ($categoria === 'rascunhos') {
    $sql .= "e.status = 'RASCUNHO'";
} else {
    $sql .= "e.status IN ('PUBLICADO', 'ENCERRADO')";
}

$sql .= " ORDER BY e.data_inicio DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$eventos = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>