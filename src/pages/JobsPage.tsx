import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useCasper } from "@/contexts/casper-context";
import { useCasperApply } from "@/hooks/use-casper-apply";
import { useToast } from "@/hooks/use-toast";
import { getNextEscrowId, getEscrow, isJobCreationPaused } from "@/lib/casper/casper-contract-service";

import type { Escrow } from "@/lib/web3/types";
import { Briefcase } from "lucide-react";
import { JobsHeader } from "@/components/jobs/jobs-header";
import { JobsStats } from "@/components/jobs/jobs-stats";
import { JobCard } from "@/components/jobs/job-card";
import { ApplicationDialog } from "@/components/jobs/application-dialog";
import { JobsLoading } from "@/components/jobs/jobs-loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function JobsPage() {
  const casper = useCasper();
  const { applyToJob } = useCasperApply();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "active" | "completed" | "disputed"
  >("all");
  const [selectedJob, setSelectedJob] = useState<Escrow | null>(null);
  // const [coverLetter, setCoverLetter] = useState(""); // Unused - handled in dialog
  // const [proposedTimeline, setProposedTimeline] = useState(""); // Unused - handled in dialog
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState<Record<string, boolean>>({});
  const [isContractPaused, setIsContractPaused] = useState(false);
  const [ongoingProjectsCount, setOngoingProjectsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [totalEscrowsCount, setTotalEscrowsCount] = useState(0); // Actual count from blockchain

  const getStatusFromNumber = (
    status: number
  ): "pending" | "disputed" | "active" | "completed" => {
    switch (status) {
      case 0:
        return "pending";
      case 1:
        return "active";
      case 2:
        return "completed";
      case 3:
        return "disputed";
      case 4:
        return "pending"; // Map cancelled to pending
      default:
        return "pending";
    }
  };

  useEffect(() => {
    if (casper.address) {
      fetchOpenJobs();
      countOngoingProjects();
    } else {
    }
    checkContractPauseStatus();
  }, [casper.address]);

  // Removed automatic refresh to prevent constant reloading

  // Check application status when jobs are loaded
  // Don't auto-check application status - fetchOpenJobs already does this
  // This useEffect was causing state to be reset to false
  // useEffect(() => {
  //   if (wallet.address && jobs.length > 0) {
  //     checkApplicationStatus();
  //   }
  // }, [wallet.address, jobs]);

  // Removed duplicate project count refresh

  const checkContractPauseStatus = async () => {
    try {
      const isPaused = await isJobCreationPaused();
      setIsContractPaused(isPaused);
    } catch (error) {
      console.error("Error checking pause status:", error);
      setIsContractPaused(false);
    }
  };

  const countOngoingProjects = async () => {
    try {
      // Use Casper contract service
      const escrowCount = await getNextEscrowId();

      let ongoingCount = 0;

      // Check all escrows to count ongoing projects for this user (both as client and freelancer)
      if (escrowCount > 1) {
        for (let i = 1; i < escrowCount; i++) {
          try {
            const escrow = await getEscrow(i);
            if (!escrow) continue;
            const escrowSummary = [escrow.creator, escrow.freelancer, null, escrow.status];

            const payerAddress = escrowSummary[0]; // depositor/client
            const beneficiaryAddress = escrowSummary[1]; // beneficiary/freelancer
            const userAddress = casper.address;

            // Check if current user is either the payer (client) or beneficiary (freelancer)
            const isPayer =
              payerAddress &&
              userAddress &&
              String(payerAddress).toLowerCase() === String(userAddress).toLowerCase();
            const isBeneficiary =
              beneficiaryAddress &&
              userAddress &&
              String(beneficiaryAddress).toLowerCase() === String(userAddress).toLowerCase();

            // Count projects where user is involved (as client or freelancer)
            if (isPayer || isBeneficiary) {
              const status = Number(escrowSummary[3]); // status is at index 3
              // Count active and pending projects (status 0 = pending, 1 = active)
              // Also count any project that's not completed, disputed, or cancelled
              if (status === 0 || status === 1) {
                ongoingCount++;
              }
            }
          } catch (error) {
            // Skip escrows that don't exist or can't be accessed
            continue;
          }
        }
      }

      setOngoingProjectsCount(ongoingCount);
    } catch (error) {
      setOngoingProjectsCount(0);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      // Check blockchain for application status for each job
      if (!casper.address || jobs.length === 0) return;

      const applicationStatus: Record<string, boolean> = {};

      for (const job of jobs) {
        try {
          // TODO: Implement hasUserApplied for Casper
          // For now, check local state only
          const hasAppliedResult = hasApplied[job.id] || false;
          applicationStatus[job.id] = hasAppliedResult;
          console.log(
            `[checkApplicationStatus] Job ${job.id} hasApplied: ${hasAppliedResult}`
          );
        } catch (error) {
          console.warn(
            `[checkApplicationStatus] Error checking job ${job.id}:`,
            error
          );
          // Preserve existing state if check fails
          applicationStatus[job.id] = hasApplied[job.id] || false;
        }
      }

      setHasApplied((prev) => ({
        ...prev,
        ...applicationStatus, // Merge with existing state instead of replacing
      }));
    } catch (error) {
      console.error("[checkApplicationStatus] Error:", error);
      // Don't reset state on error
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchOpenJobs(), countOngoingProjects()]);
      // Check application status after refreshing jobs
      if (casper.address && jobs.length > 0) {
        await checkApplicationStatus();
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Clear application status cache when wallet changes
  useEffect(() => {
    setHasApplied({});
  }, [casper.address]);

  const fetchOpenJobs = async () => {
    setLoading(true);
    try {
      // Fetch all data from blockchain via Casper contract service
      // This ensures all displayed data is from the Casper blockchain, not mock data

      // For Casper, we use timestamps directly (created_at from contract)
      // No need for ledger sequence conversion

      // Get total number of escrows using Casper contract service
      // NO TIMEOUT - let it complete fully to get accurate count from blockchain
      const escrowCount = await getNextEscrowId();

      // Set the actual escrow count from blockchain
      // escrowCount is the next available ID, so actual count is escrowCount - 1
      const actualCount = Math.max(0, escrowCount - 1);
      setTotalEscrowsCount(actualCount);
      console.log(
        `Total escrows from blockchain: ${actualCount} (next ID: ${escrowCount})`
      );

      const openJobs: Escrow[] = [];

      // Fetch open jobs from the contract
      // escrowCount is the next available ID, so if it's 2, that means 1 escrow exists
      // But if it times out and returns 1, we should still check escrow 1 directly
      // Limit the number of escrows to fetch to prevent long loading times
      const maxEscrowsToFetch = 20; // Limit to 20 escrows max
      const escrowsToCheck = Math.min(
        Math.max(escrowCount - 1, 1),
        maxEscrowsToFetch
      );

      // Always check at least escrow 1, even if escrowCount is 1 (might be timeout default)
      if (escrowsToCheck > 0) {
        for (let i = 1; i <= escrowsToCheck; i++) {
          try {
            const escrowData = await getEscrow(i);
            if (!escrowData) {
              continue;
            }

            // Check if this is an open job (beneficiary is null or zero address)
            // For Casper, null beneficiary means it's an open job
            const zeroAddress =
              "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
            const isOpenJob =
              !escrowData.freelancer ||
              escrowData.freelancer === zeroAddress ||
              escrowData.freelancer === "";

            if (isOpenJob) {
              // Check if current user is the job creator (should not be able to apply to own job)
              const isJobCreator =
                casper.address &&
                escrowData.creator &&
                escrowData.creator.toLowerCase().trim() ===
                  casper.address.toLowerCase().trim();

              // Check if current user has already applied to this job
              // First check local state (preserves state after applying)
              let userHasApplied = hasApplied[i] || false;
              let applicationCount = 0;

              // Only check blockchain if not already in local state
              if (!userHasApplied && casper.address) {
                // TODO: Implement hasUserApplied for Casper
                // For now, set to false - applications are stored in dictionary
                userHasApplied = false;
                  console.log(
                  `User ${casper.address} has applied to job ${i}:`,
                    userHasApplied
                  );
              }

              // For Casper, timestamps are in milliseconds (blocktime)
              // created_at and deadline are u64 timestamps from get_blocktime()
              const createdTimestamp = escrowData.created_at || Date.now();
              const deadlineTimestamp = escrowData.deadline || 0;
              const durationInSeconds = deadlineTimestamp > createdTimestamp 
                ? Math.max(0, deadlineTimestamp - createdTimestamp) / 1000 
                : 0;
              const durationInDays = Math.ceil(durationInSeconds / (60 * 60 * 24));
              // Casper timestamps are already in milliseconds
              const approxCreatedAt = typeof createdTimestamp === 'number' ? createdTimestamp : Date.now();

              // Convert contract data to our Escrow type
              // All data is from blockchain - fetched via Casper contract service
              const job: Escrow = {
                id: i.toString(),
                payer: escrowData.creator, // depositor/creator (from blockchain)
                beneficiary: escrowData.freelancer || zeroAddress, // beneficiary/freelancer (from blockchain)
                token: escrowData.token || "", // token (from blockchain)
                totalAmount: escrowData.amount || "0", // totalAmount (from blockchain)
                releasedAmount: "0", // paidAmount - would need to calculate from milestones
                status: getStatusFromNumber(escrowData.status), // status (from blockchain)
                createdAt: approxCreatedAt, // Timestamp from Casper blockchain
                duration: durationInDays, // Duration in days (calculated from timestamps)
                milestones: [], // Would need to fetch milestones separately
                projectTitle: escrowData.project_title || "", // projectTitle (from blockchain)
                projectDescription: escrowData.project_description || "", // projectDescription (from blockchain)
                isOpenJob: true,
                applications: [], // Would need to fetch applications separately
                applicationCount: applicationCount, // Add real application count
                isJobCreator: !!isJobCreator, // Add flag to track if current user is the job creator (from blockchain)
              };

              // Log blockchain data for debugging
              console.log(`Job ${i} from blockchain:`, {
                id: job.id,
                creator: job.payer,
                amount: job.totalAmount,
                status: job.status,
                createdAt: new Date(job.createdAt).toISOString(),
                projectTitle: job.projectTitle,
                isJobCreator: job.isJobCreator,
              });

              openJobs.push(job);

              // Store application status from blockchain check
              setHasApplied((prev) => {
                const newState = {
                  ...prev,
                  [job.id]: userHasApplied, // Always use blockchain result
                };
                console.log(
                  `[fetchOpenJobs] Setting hasApplied[${job.id}] = ${userHasApplied}`,
                  newState
                );
                return newState;
              });
            }
          } catch (error) {
            // Skip escrows that don't exist or user doesn't have access to
            continue;
          }
        }
      }

      // Set the actual jobs from the blockchain contract
      // All data in openJobs is fetched directly from the blockchain
      console.log(`Loaded ${openJobs.length} jobs from blockchain`);
      setJobs(openJobs);
    } catch (error) {
      toast({
        title: "Failed to load jobs",
        description: "Could not fetch available jobs from the blockchain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (
    job: Escrow,
    coverLetter: string,
    proposedTimeline: string
  ) => {
    const isCasperConnected = casper.isConnected;

    if (!job || !isCasperConnected) {
        toast({ title: "Wallet not connected", description: "Please connect your Casper wallet.", variant: "destructive" });
        return;
    }

    const userAddress = casper.address;

    // Check if user is the job creator (should not be able to apply to own job)
    if (
      job.isJobCreator ||
      (userAddress && job.payer?.toLowerCase() === userAddress.toLowerCase())
    ) {
      toast({
        title: "Cannot Apply",
        description: "You cannot apply to a job you created.",
        variant: "destructive",
      });
      return;
    }

    // Check if freelancer has reached the maximum number of ongoing projects (3)
    if (ongoingProjectsCount >= 3) {
      toast({
        title: "Project Limit Reached",
        description:
          "You can only have a maximum of 3 ongoing projects at a time. Please complete or cancel some projects before applying to new ones.",
        variant: "destructive",
      });
      return;
    }

    // Check if user has already applied to this job (local state)
    if (hasApplied[job.id]) {
      toast({
        title: "Already Applied",
        description: "You have already applied to this job.",
        variant: "destructive",
      });
      return;
    }

    setApplying(true);

    // CASPER PATH
    if (isCasperConnected) {
         try {
             const deployHash = await applyToJob({
                escrowId: Number(job.id),
                coverLetter,
                proposedTimeline: Number(proposedTimeline)
             });
             if (deployHash) {
                 setHasApplied(prev => ({ ...prev, [job.id]: true }));
                 setSelectedJob(null);
                 toast({
                    title: "Application Submitted!",
                    description: "The client will review your application.",
                 });
             }
         } catch(e) {
             console.error(e);
         } finally {
             setApplying(false);
         }
         return;
    }

    // Note: Stellar path removed - using Casper only
  };

  const filteredJobs = jobs.filter((job) => {
    // Search filter
    const matchesSearch =
      job.projectDescription
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      job.milestones.some((m) =>
        m.description.toLowerCase().includes(searchQuery.toLowerCase())
      );

    // Status filter
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!casper.isConnected || loading) {
    return <JobsLoading isConnected={casper.isConnected} />;
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <JobsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
        <JobsStats
          jobs={jobs}
          openJobsCount={totalEscrowsCount}
          ongoingProjectsCount={ongoingProjectsCount}
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Label htmlFor="status-filter" className="mb-2 block">
              Filter by Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value: any) => setStatusFilter(value)}
            >
              <SelectTrigger id="status-filter" className="w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-6">
          {filteredJobs.length === 0 ? (
            <Card className="glass border-muted p-12 text-center">
              <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                No jobs found matching your search
              </p>
            </Card>
          ) : (
            filteredJobs.map((job, index) => {
              const jobHasApplied = hasApplied[job.id] || false;
              console.log(
                `[JobsPage] Rendering JobCard for job ${job.id}, hasApplied:`,
                jobHasApplied,
                "Full state:",
                hasApplied
              );
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  index={index}
                  hasApplied={jobHasApplied}
                  isContractPaused={isContractPaused}
                  ongoingProjectsCount={ongoingProjectsCount}
                  onApply={setSelectedJob}
                />
              );
            })
          )}
        </div>

        <ApplicationDialog
          job={selectedJob}
          open={!!selectedJob}
          onOpenChange={(open) => !open && setSelectedJob(null)}
          onApply={handleApply}
          applying={applying}
        />
      </div>
    </div>
  );
}
