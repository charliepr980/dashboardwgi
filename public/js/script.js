// Auto-close alerts after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
  // Auto-close alerts
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }, 5000);
  });
  
  // Add active class to current nav item
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (currentPath.startsWith(href) && href !== '/') {
      link.classList.add('active');
    }
  });
  
  // Confirm delete actions
  const deleteButtons = document.querySelectorAll('.delete-btn');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
        e.preventDefault();
      }
    });
  });
  
  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
});

// Date range picker initialization (if present)
if (typeof daterangepicker !== 'undefined') {
  const dateRangePicker = document.getElementById('daterangepicker');
  if (dateRangePicker) {
    dateRangePicker.addEventListener('click', function() {
      // Date range picker configuration
      $(this).daterangepicker({
        opens: 'left',
        locale: {
          format: 'YYYY-MM-DD'
        }
      }, function(start, end, label) {
        // Update hidden inputs with selected dates
        document.getElementById('startDate').value = start.format('YYYY-MM-DD');
        document.getElementById('endDate').value = end.format('YYYY-MM-DD');
      });
    });
  }
}

// File upload preview
const fileInput = document.querySelector('input[type="file"]');
if (fileInput) {
  fileInput.addEventListener('change', function() {
    const fileNameElement = document.querySelector('.custom-file-label');
    if (fileNameElement) {
      fileNameElement.textContent = this.files[0] ? this.files[0].name : 'Choose file';
    }
  });
}