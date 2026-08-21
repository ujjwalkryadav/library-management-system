document.addEventListener('DOMContentLoaded', () => {
  // Toggle mobile sidebar
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const adminSidebar = document.querySelector('.admin-sidebar');
  if (sidebarToggleBtn && adminSidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      adminSidebar.classList.toggle('show');
    });
  }

  // Render Charts if data is provided
  if (window.LMS_CHART_DATA && typeof Chart !== 'undefined') {
    const { monthlyTrends, categories } = window.LMS_CHART_DATA;

    // 1. Monthly Trends Line Chart (Matching Reference Image 3)
    const trendCtx = document.getElementById('monthlyTrendChart');
    if (trendCtx && monthlyTrends) {
      new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: monthlyTrends.labels,
          datasets: [
            {
              label: 'Books Issued',
              data: monthlyTrends.issues,
              borderColor: '#0F382A',
              backgroundColor: 'rgba(15, 56, 42, 0.08)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#0F382A',
              pointBorderColor: '#FFFFFF',
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7
            },
            {
              label: 'Books Returned',
              data: monthlyTrends.returns,
              borderColor: '#C89D5C',
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderDash: [5, 5],
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#C89D5C',
              pointBorderColor: '#FFFFFF',
              pointBorderWidth: 2,
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 12,
                font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '500' }
              }
            },
            tooltip: {
              backgroundColor: '#0F382A',
              titleFont: { family: "'Plus Jakarta Sans', sans-serif" },
              padding: 10,
              cornerRadius: 8
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#F1ECE2' },
              ticks: { precision: 0, font: { family: "'Plus Jakarta Sans', sans-serif" } }
            },
            x: {
              grid: { display: false },
              ticks: { font: { family: "'Plus Jakarta Sans', sans-serif" } }
            }
          }
        }
      });
    }

    // 2. Category Doughnut Chart (Matching Reference Image 3)
    const categoryCtx = document.getElementById('categoryDoughnutChart');
    if (categoryCtx && categories && categories.labels.length > 0) {
      new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
          labels: categories.labels,
          datasets: [{
            data: categories.data,
            backgroundColor: [
              '#0F382A', // Forest Green
              '#C89D5C', // Gold
              '#2563EB', // Blue
              '#7C3AED', // Purple
              '#16A34A', // Green
              '#D97706'  // Amber
            ],
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '500' },
                padding: 12
              }
            },
            tooltip: {
              backgroundColor: '#0F382A',
              padding: 10,
              cornerRadius: 8
            }
          },
          cutout: '65%'
        }
      });
    }
  }
});
