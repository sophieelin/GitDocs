<template>
  <header>
    <RouterLink to="/" class="brand">GitDocs</RouterLink>
    <nav>
      <RouterLink to="/repositories">Repositories</RouterLink>
      <RouterLink to="/proposals">My proposals</RouterLink>
      <RouterLink to="/reviews">Reviews</RouterLink>
      <RouterLink to="/sign-in">Sign in</RouterLink>
    </nav>
  </header>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.brand {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  text-decoration: none;
}

nav {
  display: flex;
  gap: 20px;
}

nav a {
  color: #4b5563;
  text-decoration: none;
}

nav a.router-link-active {
  color: #2563eb;
  font-weight: 600;
}
</style>
