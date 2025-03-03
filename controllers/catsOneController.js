// controllers/catsOneController.js
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// CatsOne API configuration
const CATSONE_API_KEY = '7e2f011c8921320550eb74960f3e1c26';
const CATSONE_API_URL = 'https://api.catsone.com/v3';

// Setup axios instance for CatsOne API
const catsOneApi = axios.create({
  baseURL: CATSONE_API_URL,
  headers: {
    'Authorization': `Token ${CATSONE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Helper function to calculate age in days
const calculateAge = (createdDate) => {
  const created = new Date(createdDate);
  const today = new Date();
  const diffTime = Math.abs(today - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Helper function to determine row color based on age
const getRowColor = (age) => {
  if (age <= 30) {
    return 'light-green'; // Light green for < 30 days
  } else if (age <= 60) {
    return 'pale-blue'; // Pale blue for 31-60 days
  } else {
    return 'pale-red'; // Pale red for > 60 days
  }
};

// Get active jobs from CatsOne API
exports.getActiveJobs = async (req, res) => {
  try {
    // Get job statuses
    const statusResponse = await req.catsOneApi.get('/jobs/statuses');
    const statusMap = {};
    if (statusResponse.data && statusResponse.data._embedded && statusResponse.data._embedded.statuses) {
      statusResponse.data._embedded.statuses.forEach(status => {
        statusMap[status.id] = status.title || "Unknown";
      });
    }
    
    // Define active status IDs
    const activeStatusIds = ['5646830', '6312197', '6407892', '5696589'];
    
    // Let's try to get recent jobs with different parameters
    console.log("Trying alternative API parameters...");
    
    const attempts = [
      {
        description: "Sort by ID descending (newest first)",
        params: {
          'sort': '-id',
          'limit': 25
        }
      },
      {
        description: "Get jobs from 2023 onwards",
        params: {
          'filter[date_created][GT]': '2023-01-01T00:00:00',
          'limit': 25
        }
      },
      {
        description: "Filter by active status with additional includes",
        params: {
          'filter[status_id]': '5646830', // Active status
          'include': 'company,submissions',
          'limit': 25
        }
      },
      {
        description: "Use different filter format",
        params: {
          'filter[status_id][IN]': ['5646830', '6312197', '6407892', '5696589'].join(','),
          'limit': 25
        }
      },
      {
        description: "Sort by date modified descending",
        params: {
          'sort': '-date_modified',
          'limit': 25
        }
      }
    ];
    
    let successfulJobs = [];
    let jobStructure = null;
    
    for (const attempt of attempts) {
      console.log(`Attempting: ${attempt.description}`);
      
      try {
        const response = await req.catsOneApi.get('/jobs', {
          params: attempt.params
        });
        
        if (response.data && response.data._embedded && response.data._embedded.jobs) {
          const jobs = response.data._embedded.jobs;
          console.log(`Found ${jobs.length} jobs with "${attempt.description}"`);
          
          if (jobs.length > 0) {
            // Get the date range
            console.log(`Date range: ${jobs[0].date_created} to ${jobs[jobs.length-1].date_created}`);
            
            // If we haven't examined job structure yet, do it now
            if (!jobStructure && jobs.length > 0) {
              jobStructure = {
                keys: Object.keys(jobs[0]),
                embeddedKeys: Object.keys(jobs[0]._embedded || {}),
                sampleValues: {}
              };
              
              // Get sample values for key fields
              for (const key of jobStructure.keys) {
                jobStructure.sampleValues[key] = jobs[0][key];
              }
              
              console.log("Job structure:", JSON.stringify(jobStructure, null, 2));
            }
            
            // Add these jobs to our collection
            successfulJobs.push(...jobs);
          }
        } else {
          console.log(`No jobs found for "${attempt.description}"`);
        }
      } catch (error) {
        console.log(`Error with "${attempt.description}": ${error.message}`);
      }
    }
    
    // If we found jobs, process them
    console.log(`Total jobs collected from all attempts: ${successfulJobs.length}`);
    
    // Process the jobs
    const processedJobs = successfulJobs.map(job => {
      const created = job.date_created || null;
      const age = created ? calculateAge(created) : 0;
      const openings = job.openings || 0;
      const submitted = job.submitted || 0;
      const remaining = openings - submitted;
      const rowColor = getRowColor(age);
      
      let companyName = 'N/A';
      if (job._embedded && job._embedded.company && job._embedded.company.name) {
        companyName = job._embedded.company.name;
      }
      
      return {
        id: job.id || 'N/A',
        created: created ? new Date(created).toLocaleDateString() : 'N/A',
        age: age,
        ourId: job.external_id || 'N/A',
        company: companyName,
        status: statusMap[job.status_id] || `Unknown (${job.status_id})`,
        status_id: job.status_id,
        positionsRequested: job.title || 'N/A',
        openings: openings,
        submitted: submitted,
        remaining: remaining,
        billRate: job.max_rate ? `$${job.max_rate}` : 'N/A',
        notes: job.notes || job.description || 'N/A',
        rowColor: rowColor
      };
    });
    
    // Sort by age (newest first)
    processedJobs.sort((a, b) => a.age - b.age);
    
    res.render('catsone/index', {
      title: 'CatsOne Jobs',
      jobs: processedJobs,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching CatsOne jobs:', error.message);
    req.flash('error_msg', 'Failed to fetch jobs from CatsOne API');
    res.render('catsone/index', {
      title: 'CatsOne Jobs',
      jobs: [],
      user: req.session.user
    });
  }
};

// Export active jobs to Excel
exports.exportActiveJobs = async (req, res) => {
  try {
    // Get the status mappings
    const statusResponse = await req.catsOneApi.get('/jobs/statuses');
    
    // Create a mapping of status_id to status name
    const statusMap = {};
    if (statusResponse.data && statusResponse.data._embedded && statusResponse.data._embedded.statuses) {
      statusResponse.data._embedded.statuses.forEach(status => {
        statusMap[status.id] = status.name || "Unknown";
      });
    }
    
    // Define the status IDs we want to filter for
    const activeStatusIds = ['5646830', '6312197', '6407892', '5696589'];
    
    // Fetch jobs from CatsOne API
    const response = await req.catsOneApi.get('/jobs', {
      params: {
        limit: 100
      }
    });

    // Get jobs from the _embedded.jobs property
    let jobsData = [];
    if (response.data && response.data._embedded && response.data._embedded.jobs) {
      jobsData = response.data._embedded.jobs;
    }

    // Process jobs data for Excel
    const jobsForExcel = jobsData.map(job => {
      const created = job.date_created || null;
      const age = created ? calculateAge(created) : 0;
      const openings = job.openings || 0;
      const submitted = job.submitted || 0;

      // Extract company name if available
      let companyName = 'N/A';
      if (job._embedded && job._embedded.company && job._embedded.company.name) {
        companyName = job._embedded.company.name;
      }

      // Get status name from the status map
      const statusName = job.status_id && statusMap[job.status_id] ? statusMap[job.status_id] : 'Unknown';

      return {
        'ID': job.id || 'N/A',
        'Created': created ? new Date(created).toLocaleDateString() : 'N/A',
        'Age (days)': age,
        'Our ID': job.external_id || 'N/A',
        'Company': companyName,
        'Status': statusName,
        'Positions Requested': job.title || 'N/A',
        'Openings': openings,
        'Submitted': submitted,
        'Remaining': openings - submitted,
        'Bill Rate': job.max_rate ? `$${job.max_rate}` : 'N/A',
        'Notes': job.notes || job.description || 'N/A'
      };
    });

    // Filter the jobs based on the status IDs we want
    const filteredJobsForExcel = jobsForExcel.filter(job => {
      return activeStatusIds.includes(job.status_id);
    });

    // Use all jobs for now if filtering doesn't work
    const jobsToExport = filteredJobsForExcel.length > 0 ? filteredJobsForExcel : jobsForExcel;

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(jobsToExport);

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'CatsOne Active Jobs');

    // Create directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate a unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `catsone_active_jobs_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    // Write the workbook to a file
    XLSX.writeFile(wb, filepath);

    // Send the file as a download
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading Excel file:', err);
        req.flash('error_msg', 'Error downloading file');
        res.redirect('/catsone');
      }
      
      // Delete the file after download (optional)
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp Excel file:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Error exporting CatsOne jobs to Excel:', error.message);
    req.flash('error_msg', 'Failed to export jobs to Excel');
    res.redirect('/catsone');
  }
};