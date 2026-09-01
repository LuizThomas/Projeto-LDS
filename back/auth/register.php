<?php
require_once '../conexao.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nome       = trim($_POST['fullName'] ?? $_POST['nome'] ?? '');
    $email      = trim($_POST['email'] ?? '');
    $senha      = $_POST['password'] ?? $_POST['senha'] ?? '';
    $conf_senha = $_POST['confirmPassword'] ?? $_POST['conf_senha'] ?? '';

    if ($senha !== $conf_senha) {
        die("Erro: Senha incorreta.");
    }

    $senha_hash = password_hash($senha, PASSWORD_DEFAULT);
    $sql = "INSERT INTO usuario (nome, email, senha_hash) 
            VALUES (:nome, :email, :senha_hash)";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':nome'       => $nome,
            ':email'      => $email,
            ':senha_hash' => $senha_hash
        ]);
        header("Location: ../../front/pages(html)/auth/login.html?status=sucesso");
        exit;

    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            echo "Erro: O e-mail informado já está cadastrado no sistema.";
        } else {
            echo "Erro no banco de dados ao realizar cadastro: " . $e->getMessage();
        }
    }
}
?>