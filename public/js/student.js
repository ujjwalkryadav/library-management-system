// Student Portal Script
document.addEventListener('DOMContentLoaded', () => {
  // Notification AJAX Read Click handler
  document.querySelectorAll('.mark-read-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const notifId = btn.getAttribute('data-notif-id');
      if (!notifId) return;

      try {
        const res = await fetch(`/notifications/${notifId}/read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (res.ok) {
          const item = document.getElementById(`notif-item-${notifId}`);
          if (item) {
            item.classList.remove('bg-light', 'border-primary');
            item.classList.add('opacity-75');
            btn.remove();
          }
        }
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    });
  });
});
