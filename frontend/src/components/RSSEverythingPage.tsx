'use client';

import { useRSSEverything } from '@/hooks/useRSSEverything';
import {
  StepHeader,
  UrlStep,
  ListSelectorStep,
  DetailSelectorStep,
  PreviewStep,
  SaveStep,
} from './rss-everything';

export default function RSSEverythingPage() {
  const {
    // State
    currentStep,
    url,
    useBrowser,
    waitSelector,
    isLoading,
    error,
    parseMode,
    listHtml,
    listSelectors,
    detailHtml,
    detailUrl,
    detailSelectors,
    previewItems,
    previewLoading,
    name,
    selectedCategoryId,
    refreshInterval,
    customHeaders,
    dateFormats,
    excludeSelectors,
    isSaving,
    activeListField,
    activeDetailField,
    categories,
    currentStepIndex,
    // Validation
    selectorValidation,
    isValidating,

    // Setters
    setUrl,
    setUseBrowser,
    setWaitSelector,
    setParseMode,
    setListSelectors,
    setDetailUrl,
    setDetailSelectors,
    setName,
    setSelectedCategoryId,
    setRefreshInterval,
    setCustomHeaders,
    setDateFormats,
    setExcludeSelectors,
    setActiveListField,
    setActiveDetailField,

    // Actions
    handleFetchListHTML,
    handleFetchDetailHTML,
    handleListSelectorFromViewer,
    handleDetailSelectorFromViewer,
    handleListSelectNext,
    handlePreview,
    handleSave,
    handleReset,
    goBack,
    goToSave,
    // Validation
    handleValidateSelectors,
  } = useRSSEverything();

  return (
    <div className="h-full bg-background overflow-auto">
      <StepHeader
        currentStepIndex={currentStepIndex}
        onReset={handleReset}
      />

      <div className="mx-auto px-4 py-2 max-w-[1600px]">
        {error && (
          <div className="mb-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {currentStep === 'url' && (
          <UrlStep
            url={url}
            useBrowser={useBrowser}
            waitSelector={waitSelector}
            parseMode={parseMode}
            isLoading={isLoading}
            customHeaders={customHeaders}
            onUrlChange={setUrl}
            onUseBrowserChange={setUseBrowser}
            onWaitSelectorChange={setWaitSelector}
            onParseModeChange={setParseMode}
            onCustomHeadersChange={setCustomHeaders}
            onFetch={handleFetchListHTML}
          />
        )}

        {currentStep === 'list-select' && listHtml && (
          <ListSelectorStep
            parseMode={parseMode}
            listHtml={listHtml}
            url={url}
            listSelectors={listSelectors}
            activeListField={activeListField}
            previewLoading={previewLoading}
            dateFormats={dateFormats}
            excludeSelectors={excludeSelectors}
            selectorValidation={selectorValidation}
            isValidating={isValidating}
            onValidate={handleValidateSelectors}
            onListSelectorsChange={setListSelectors}
            onActiveListFieldChange={setActiveListField}
            onSelectorFromViewer={handleListSelectorFromViewer}
            onDateFormatsChange={setDateFormats}
            onExcludeSelectorsChange={setExcludeSelectors}
            onBack={goBack}
            onNext={handleListSelectNext}
            onPreview={handlePreview}
          />
        )}

        {currentStep === 'detail-select' && (
          <DetailSelectorStep
            detailUrl={detailUrl}
            detailHtml={detailHtml}
            detailSelectors={detailSelectors}
            activeDetailField={activeDetailField}
            isLoading={isLoading}
            previewLoading={previewLoading}
            dateFormats={dateFormats}
            excludeSelectors={excludeSelectors}
            onDetailUrlChange={setDetailUrl}
            onDetailSelectorsChange={setDetailSelectors}
            onActiveDetailFieldChange={setActiveDetailField}
            onSelectorFromViewer={handleDetailSelectorFromViewer}
            onDateFormatsChange={setDateFormats}
            onExcludeSelectorsChange={setExcludeSelectors}
            onFetchDetail={handleFetchDetailHTML}
            onBack={goBack}
            onPreview={handlePreview}
          />
        )}

        {currentStep === 'preview' && (
          <PreviewStep
            previewItems={previewItems}
            onBack={goBack}
            onContinue={goToSave}
          />
        )}

        {currentStep === 'save' && (
          <SaveStep
            name={name}
            selectedCategoryId={selectedCategoryId}
            refreshInterval={refreshInterval}
            customHeaders={customHeaders}
            categories={categories}
            isSaving={isSaving}
            onNameChange={setName}
            onCategoryChange={setSelectedCategoryId}
            onRefreshIntervalChange={setRefreshInterval}
            onCustomHeadersChange={setCustomHeaders}
            onBack={goBack}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
