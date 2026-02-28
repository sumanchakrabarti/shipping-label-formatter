import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

@MainActor
class LabelViewModel: ObservableObject {
    // Label images
    @Published var label1: UIImage?
    @Published var label2: UIImage?

    // Options
    @Published var fitMode: FitMode = .fit
    @Published var autoCrop: Bool = true

    // UI state
    @Published var activeSlot: Int = 0
    @Published var showingImportOptions = false
    @Published var showingPhotoPicker = false
    @Published var showingFilePicker = false
    @Published var showingCamera = false
    @Published var showingShareSheet = false
    @Published var isProcessing = false
    @Published var errorMessage: String?

    // Photo picker
    @Published var photoSelection: PhotosPickerItem?

    // Output
    @Published var generatedPDF: Data?

    // MARK: - Set image to active slot

    func setImage(_ image: UIImage) {
        if activeSlot == 0 {
            label1 = image
        } else {
            label2 = image
        }
        errorMessage = nil
    }

    // MARK: - Load from PhotosPicker

    func loadFromPhotoPicker(_ item: PhotosPickerItem?) {
        guard let item else { return }

        Task {
            do {
                if let data = try await item.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    setImage(image)
                }
            } catch {
                errorMessage = "Failed to load photo: \(error.localizedDescription)"
            }
            photoSelection = nil
        }
    }

    // MARK: - Load from File Importer

    func loadFromFileImporter(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }

            guard url.startAccessingSecurityScopedResource() else {
                errorMessage = "Cannot access file"
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            do {
                let data = try Data(contentsOf: url)
                let ext = url.pathExtension.lowercased()

                if ext == "pdf" {
                    if let image = LabelProcessor.loadImageFromPDF(data: data) {
                        setImage(image)
                    } else {
                        errorMessage = "Failed to read PDF"
                    }
                } else {
                    if let image = UIImage(data: data) {
                        setImage(image)
                    } else {
                        errorMessage = "Unsupported image format"
                    }
                }
            } catch {
                errorMessage = "Failed to load file: \(error.localizedDescription)"
            }

        case .failure(let error):
            errorMessage = "File picker error: \(error.localizedDescription)"
        }
    }

    // MARK: - Generate PDF

    func generatePDF() {
        guard let label1 else { return }

        isProcessing = true
        errorMessage = nil

        Task.detached { [autoCrop, fitMode, label2] in
            var images = [label1]
            if let label2 { images.append(label2) }

            let pdfData = LabelProcessor.processLabels(
                images: images,
                autoCrop: autoCrop,
                fitMode: fitMode
            )

            await MainActor.run { [weak self] in
                self?.generatedPDF = pdfData
                self?.isProcessing = false
                self?.showingShareSheet = true
            }
        }
    }
}
