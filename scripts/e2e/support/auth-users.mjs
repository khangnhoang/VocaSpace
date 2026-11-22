export async function ensureAuthUser(supabase, user) {
  const { data, error } = await supabase.auth.admin.getUserById(user.id);

  if (error || !data?.user) {
    const created = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName,
        username: user.username,
      },
    });

    if (created.error) {
      throw new Error(`Cannot create auth user ${user.email}: ${created.error.message}`);
    }
    return;
  }

  const updated = await supabase.auth.admin.updateUserById(user.id, {
    email: user.email,
    password: user.password,
    email_confirm: true,
    ban_duration: "none",
    user_metadata: {
      full_name: user.fullName,
      username: user.username,
    },
  });

  if (updated.error) {
    throw new Error(`Cannot update auth user ${user.email}: ${updated.error.message}`);
  }
}

// Chỉ tạo khi chưa có, không `updateUserById`: tài khoản worker-scoped có thể đang đăng nhập trong trình duyệt của test
// (fixture được dựng lại giữa test), và việc đặt lại mật khẩu/metadata có thể làm mất phiên đó (G3).
export async function ensureAuthUserOnce(supabase, user) {
  const { data } = await supabase.auth.admin.getUserById(user.id);
  if (data?.user) return;

  const created = await supabase.auth.admin.createUser({
    id: user.id,
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      username: user.username,
    },
  });

  if (created.error) {
    throw new Error(`Cannot create auth user ${user.email}: ${created.error.message}`);
  }
}
