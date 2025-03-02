// Combined dashboard.js file
document.addEventListener('DOMContentLoaded', function() {
  // ===== PROGRESS BAR ANIMATIONS =====
  // Animate progress bars
  const progressBars = document.querySelectorAll('.progress-bar');
  progressBars.forEach(bar => {
    const width = bar.getAttribute('aria-valuenow') + '%';
    // Start with 0 width and animate to final width
    bar.style.width = '0%';
    setTimeout(() => {
      bar.style.transition = 'width 1s ease-in-out';
      bar.style.width = width;
    }, 100);
  });
  
  // Add tooltips to the metric values
  const metricValues = document.querySelectorAll('.fw-bold');
  metricValues.forEach(value => {
    if (value.classList.contains('text-success')) {
      value.setAttribute('title', 'Goal achieved!');
    } else if (value.classList.contains('text-danger')) {
      value.setAttribute('title', 'Below target');
    }
  });
  
  // Enhance UI with on-hover effects
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.addEventListener('mouseover', function() {
      this.style.boxShadow = '0 0.5rem 1rem rgba(0, 0, 0, 0.15)';
      this.style.transform = 'translateY(-5px)';
      this.style.transition = 'all 0.3s ease';
    });
    
    card.addEventListener('mouseout', function() {
      this.style.boxShadow = '';
      this.style.transform = '';
    });
  });

  // ===== DATE RANGE PICKER =====
  // Handle date range picker
  const dateRangePreset = document.getElementById('dateRangePreset');
  if (dateRangePreset) {
    dateRangePreset.addEventListener('change', toggleCustomDateRange);
  }
  
  // Initialize datepicker fields if they exist
  initializeDatePickers();
  
  // ===== RESPONSIVE UI =====
  // Handle sidebar toggle for mobile
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
      document.querySelector('.sidebar').classList.toggle('show-sidebar');
    });
  }
  
  // ===== SEARCH & PAGINATION =====
  // Handle pagination in search forms
  const paginationLinks = document.querySelectorAll('.pagination .page-link');
  if (paginationLinks.length > 0) {
    paginationLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        if (!this.dataset.page) return;
        
        e.preventDefault();
        
        // Get the search form
        const searchForm = document.getElementById('searchForm');
        if (!searchForm) return;
        
        // Update the page number in the form
        const pageInput = searchForm.querySelector('input[name="page"]');
        if (pageInput) {
          pageInput.value = this.dataset.page;
        } else {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'page';
          input.value = this.dataset.page;
          searchForm.appendChild(input);
        }
        
        // Submit the form
        searchForm.submit();
      });
    });
  }
  
  // Handle form reset buttons
  const resetButtons = document.querySelectorAll('form .btn-secondary');
  if (resetButtons.length > 0) {
    resetButtons.forEach(button => {
      if (button.textContent.trim().toLowerCase() === 'reset') {
        button.addEventListener('click', function(e) {
          e.preventDefault();
          
          const form = this.closest('form');
          if (!form) return;
          
          // Clear all inputs except hidden ones that need to be preserved
          const inputs = form.querySelectorAll('input:not([type="hidden"]), select');
          inputs.forEach(input => {
            if (input.tagName === 'SELECT') {
              input.selectedIndex = 0;
            } else {
              input.value = '';
            }
          });
          
          // Submit the form
          form.submit();
        });
      }
    });
  }
});

// Function to toggle custom date range inputs visibility
function toggleCustomDateRange() {
  const preset = document.getElementById('dateRangePreset').value;
  const customDateRangeElements = document.querySelectorAll('.custom-date-range');
  
  customDateRangeElements.forEach(element => {
    if (preset === 'custom') {
      element.classList.remove('d-none');
    } else {
      element.classList.add('d-none');
    }
  });
}

// Function to initialize date pickers
function initializeDatePickers() {
  // If you're using flatpickr or another date picker library, initialize it here
  // This example uses native HTML5 date inputs which don't need initialization
  
  // Set min/max dates for custom date range
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  
  if (startDateInput && endDateInput) {
    // Set today as the max date for both inputs
    const today = new Date().toISOString().split('T')[0];
    startDateInput.setAttribute('max', today);
    endDateInput.setAttribute('max', today);
    
    // When start date changes, update end date min value
    startDateInput.addEventListener('change', function() {
      endDateInput.setAttribute('min', this.value);
      
      // If end date is now less than start date, update it
      if (endDateInput.value && endDateInput.value < this.value) {
        endDateInput.value = this.value;
      }
    });
    
    // When end date changes, update start date max value
    endDateInput.addEventListener('change', function() {
      startDateInput.setAttribute('max', this.value);
      
      // If start date is now greater than end date, update it
      if (startDateInput.value && startDateInput.value > this.value) {
        startDateInput.value = this.value;
      }
    });
  }
}

// Function to format dates for display
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString(undefined, options);
}

// Helper function to update charts if we have any
function updateCharts() {
  // If you have any charts on the dashboard, update them here
  if (window.dashboardCharts) {
    for (const chartId in window.dashboardCharts) {
      if (window.dashboardCharts.hasOwnProperty(chartId)) {
        window.dashboardCharts[chartId].update();
      }
    }
  }
}